import { SPARK_MODEL_ID } from "@/src/models";
import { tutorialFromSparkPayload } from "@/src/schema/attribution";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import { validateTutorialSteps } from "@/src/schema/validate";
import { INSTRUCT_STILL_WIDTH } from "@/src/coach/keyframe";
import { consumeMetaCalls, DailyCapError } from "./daily-cap";
import { readModelApiKey } from "./env";
import { guardMetaRoute, dailyCapResponse } from "./meta-guard";
import { forwardMuseRequest, musePublicDegrade } from "./muse-forward";
import { modelExecutionMode } from "./model-execution";
import { readLimitedBody } from "./request-body";
import { metaUpstreamLog, pathnameOf, readUpstreamHeaders, sparkFailureLog } from "./meta-log";
import { redactSecrets } from "./redact";
import { responsesUrl } from "./sam-request";
import { coerceInstructDocument, INSTRUCT_CLIP_MEDIA, INSTRUCT_CLIP_SEC, instructStructureProblem } from "./instruct-coerce";
import { looksLikeModelRefusal, REFUSAL_NOT_VISUAL, REFUSAL_UNSAFE, screenGoal } from "@/src/safety/goal-screen";
import { buildSparkResponsesBody, goalInstruction } from "./spark-request";
import type { SparkResult } from "./types";

export { REFUSAL_NOT_VISUAL, REFUSAL_UNSAFE, screenGoal };

export const INSTRUCT_DEBUG_MAX = 4096;

export const INSTRUCT_STILL_MAX_BYTES = 2 * 1024 * 1024;
export const INSTRUCT_GOAL_MAX = 240;
export const INSTRUCT_CREDIT = "You · instruction mode";

export interface InstructInput {
  goal: string;
  imageDataUrl: string;
  mimeType: string;
}

export interface InstructModelReply {
  status: number;
  payload: unknown;
  rawText?: string;
}

export type InstructAsk = (body: ReturnType<typeof buildSparkResponsesBody>) => Promise<InstructModelReply>;

export interface InstructDeps {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  ask?: InstructAsk;
  /** Worker route already checked the per-IP guard. */
  skipGuard?: boolean;
  /** Worker route must call Meta itself and must not forward again. */
  skipForward?: boolean;
}

type InputResult =
  | { ok: true; value: InstructInput }
  | { ok: false; status: number; code: string; message: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function cleanRefusalReason(reason: unknown, fallback = REFUSAL_UNSAFE): string {
  if (typeof reason !== "string") return fallback;
  const text = reason.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
  if (!text || text.length > 240) return fallback;
  if (/[<>]|https?:/i.test(text)) return fallback;
  return text;
}

function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function validateInstructInput(raw: unknown): InputResult {
  const record = asRecord(raw);
  if (!record) return { ok: false, status: 400, code: "invalid", message: "Enter a goal and a still." };
  const goal = typeof record.goal === "string" ? record.goal.trim() : "";
  const imageDataUrl = typeof record.imageDataUrl === "string" ? record.imageDataUrl.trim() : "";
  const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim().toLowerCase() : "";
  if (!goal) return { ok: false, status: 400, code: "empty_goal", message: "Enter a goal." };
  if (goal.length > INSTRUCT_GOAL_MAX) {
    return { ok: false, status: 400, code: "goal_too_long", message: "Keep the goal under 240 characters." };
  }
  if (mimeType !== "image/jpeg") return { ok: false, status: 400, code: "bad_type", message: "The still must be a JPEG." };
  const prefix = "data:image/jpeg;base64,";
  if (!imageDataUrl.startsWith(prefix)) {
    return { ok: false, status: 400, code: "bad_type", message: "The still must be a JPEG data URL." };
  }
  const base64 = imageDataUrl.slice(prefix.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length < 16) {
    return { ok: false, status: 400, code: "bad_type", message: "The still must be a JPEG data URL." };
  }
  if (decodedBytes(base64) > INSTRUCT_STILL_MAX_BYTES) {
    return { ok: false, status: 413, code: "too_large", message: "The still is too large. Move closer or try again." };
  }
  return { ok: true, value: { goal, imageDataUrl, mimeType } };
}

function outputText(payload: unknown): string {
  const record = asRecord(payload);
  if (!record) return "";
  if (typeof record.output_text === "string") return record.output_text;
  const chunks: string[] = [];
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    const content = asRecord(item)?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = asRecord(part)?.text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.join("\n");
}

function jsonFromText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Spark response did not contain JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export function readModelPayload(body: unknown): unknown {
  let parsed = body;
  if (typeof body === "string") {
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      return jsonFromText(body);
    }
  }
  const text = outputText(parsed);
  if (!text.trim()) return parsed;
  return jsonFromText(text);
}

function readRefusal(payload: unknown): string | null {
  if (typeof payload === "string") return looksLikeModelRefusal(payload) ? REFUSAL_UNSAFE : null;
  const record = asRecord(payload);
  if (!record) return null;
  if (record.refused === true) return cleanRefusalReason(record.reason);
  if (Array.isArray(record.steps) && record.steps.length > 0) return null;
  const blob = [record.reason, record.message, record.text].filter((part) => typeof part === "string").join(" ");
  if (blob && looksLikeModelRefusal(blob)) return cleanRefusalReason(record.reason, REFUSAL_UNSAFE);
  return null;
}

function clampPlan(tutorial: TutorialSteps, goal: string): { ok: true; value: TutorialSteps } | { ok: false; message: string } {
  const steps = tutorial.steps.filter((step) => step.objects.length > 0).slice(0, 4);
  if (!steps.length) return { ok: false, message: "The plan needs at least one object." };
  for (const step of steps) {
    step.objects = step.objects.slice(0, 4);
  }
  steps.forEach((step, index) => {
    step.index = index;
  });
  tutorial.steps = steps;
  tutorial.sampleLabel = false;
  tutorial.title = goal.trim().slice(0, 80) || "Instruction mode";
  tutorial.attribution = {
    creatorName: "You",
    creditLine: INSTRUCT_CREDIT,
    licence: "self_filmed_sample",
  };
  tutorial.runtimeHints = {
    preferredLiveMode: "keyframe_still",
    maxObjectsPerStep: 4,
  };
  for (const step of tutorial.steps) {
    step.credit = { creditLine: INSTRUCT_CREDIT, creatorName: "You", sampleLabel: false };
  }
  const validated = validateTutorialSteps(tutorial);
  if (!validated.ok) return { ok: false, message: validated.errors[0]?.message || "The steps JSON did not validate." };
  return { ok: true, value: validated.value };
}

function valueAt(root: unknown, path: string): unknown {
  if (!path || path === "/") return root;
  let current: unknown = root;
  for (const part of path.split("/").filter(Boolean)) {
    if (Array.isArray(current)) current = current[Number(part)];
    else if (current && typeof current === "object") current = (current as Record<string, unknown>)[part];
    else return undefined;
  }
  return current;
}

function previewValue(value: unknown): string {
  let text = "";
  try {
    text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  } catch {
    text = "";
  }
  text = text.replace(/\s+/g, " ");
  if (text.length > 80) text = `${text.slice(0, 80)}...`;
  return text;
}

export function instructDebugText(raw: string, secrets: Array<string | null | undefined> = []): string {
  return redactSecrets(raw, secrets).slice(0, INSTRUCT_DEBUG_MAX);
}

export function logInstructSchemaErrors(payload: unknown, errors: Array<{ path: string; message: string }>) {
  for (const error of errors) {
    const path = error.path || "/";
    console.error(`instruct schema path=${path} value=${previewValue(valueAt(payload, path))}`);
  }
}

export function normalizeInstructPayload(
  payload: unknown,
  goal: string,
  mode: "live" | "mock",
  latencyMs = 0,
  rawText?: string,
): SparkResult {
  const refusal = readRefusal(payload);
  if (refusal) {
    return {
      mode,
      modelId: SPARK_MODEL_ID,
      latencyMs,
      schemaValid: false,
      parseOk: true,
      errors: [],
      tutorial: null,
      toolCalls: [],
      inputKind: "instruct",
      refused: true,
      refusalReason: refusal,
    };
  }
  const toolCalls: ToolCall[] = [
    {
      tool: "muse_spark",
      modelId: SPARK_MODEL_ID,
      purpose: mode === "mock" ? "mock_instruction_no_live_call" : "goal_still_to_steps_json",
      inputKind: "image",
      latencyMs,
    },
  ];
  const structure = instructStructureProblem(payload);
  const { value: coerced, coercions } = coerceInstructDocument(payload, goal);
  for (const item of coercions) {
    console.error(`instruct schema path=${item.path || "/"} value=${item.value}`);
  }
  const coercedRecord = asRecord(coerced);
  const coercedDomain = coercedRecord?.domain;
  const domain = coercedDomain === "indian_recipe" || coercedDomain === "non_cooking_diy" || coercedDomain === "other"
    ? coercedDomain
    : "non_cooking_diy";
  if (structure) {
    return {
      mode,
      modelId: SPARK_MODEL_ID,
      latencyMs,
      schemaValid: false,
      parseOk: true,
      errors: [structure],
      tutorial: null,
      toolCalls,
      inputKind: "instruct",
      debug: rawText === undefined ? undefined : instructDebugText(rawText),
    };
  }
  const normalized = tutorialFromSparkPayload(coerced, {
    creatorName: "You",
    licence: "self_filmed",
  }, {
    title: goal.slice(0, 80),
    domain,
    filename: "workspace-still.jpg",
    durationSec: INSTRUCT_CLIP_SEC,
    mode: "muse_spark_live",
  });
  if (!normalized.ok) {
    logInstructSchemaErrors(coerced, normalized.errors);
    return {
      mode,
      modelId: SPARK_MODEL_ID,
      latencyMs,
      schemaValid: false,
      parseOk: true,
      errors: normalized.errors.map((error) => error.message),
      tutorial: null,
      toolCalls,
      inputKind: "instruct",
      debug: rawText === undefined ? undefined : instructDebugText(rawText),
    };
  }
  normalized.value.generation.toolCalls = toolCalls;
  normalized.value.generation.modelId = SPARK_MODEL_ID;
  const clamped = clampPlan(normalized.value, goal);
  if (!clamped.ok) {
    return {
      mode,
      modelId: SPARK_MODEL_ID,
      latencyMs,
      schemaValid: false,
      parseOk: true,
      errors: [clamped.message],
      tutorial: null,
      toolCalls,
      inputKind: "instruct",
    };
  }
  clamped.value.generation.toolCalls = toolCalls;
  clamped.value.sourceClip.stillPlaceholder = true;
  clamped.value.sourceClip.mediaType = INSTRUCT_CLIP_MEDIA;
  clamped.value.sourceClip.durationSec = INSTRUCT_CLIP_SEC;
  return {
    mode,
    modelId: SPARK_MODEL_ID,
    latencyMs,
    schemaValid: true,
    parseOk: true,
    errors: [],
    tutorial: clamped.value,
    toolCalls,
    inputKind: "instruct",
  };
}

function cannedPayload(goal: string) {
  const title = goal.trim().slice(0, 80);
  return {
    title,
    steps: [
      {
        instructionText: "Set the cup and spoon fully in frame.",
        objects: [
          { noun: "cup", samPrompt: "cup" },
          { noun: "spoon", samPrompt: "spoon" },
        ],
      },
      {
        instructionText: "Bring the bowl and cloth into the workspace.",
        objects: [
          { noun: "bowl", samPrompt: "bowl" },
          { noun: "cloth", samPrompt: "cloth" },
        ],
      },
      {
        instructionText: "Leave the cup and bowl fully visible.",
        objects: [
          { noun: "cup", samPrompt: "cup" },
          { noun: "bowl", samPrompt: "bowl" },
        ],
      },
    ],
  };
}

export async function askInstructModel(
  body: ReturnType<typeof buildSparkResponsesBody>,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<InstructModelReply> {
  const key = readModelApiKey(env);
  if (!key) return { status: 200, payload: cannedPayload("Instruction mode"), rawText: "" };
  const reserved = consumeMetaCalls(1);
  if (!reserved.ok) throw new DailyCapError(reserved.message);
  const url = responsesUrl(env);
  const started = performance.now();
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([AbortSignal.timeout(45_000), ...(signal ? [signal] : [])]),
  });
  const text = await response.text();
  const ids = readUpstreamHeaders(response.headers);
  const latencyMs = Math.round(performance.now() - started);
  const safe = redactSecrets(text, [key]);
  const rawText = safe.slice(0, INSTRUCT_DEBUG_MAX);
  if (response.status < 200 || response.status >= 300) {
    console.error(sparkFailureLog({
      status: response.status,
      url,
      body: safe,
      requestId: ids.requestId,
      route: ids.route,
      latencyMs,
      model: SPARK_MODEL_ID,
      secrets: [key],
    }));
    return { status: response.status, payload: null, rawText };
  }
  console.error(metaUpstreamLog({
    path: pathnameOf(url),
    model: SPARK_MODEL_ID,
    status: response.status,
    requestId: ids.requestId,
    route: ids.route,
    latencyMs,
  }));
  try {
    return { status: response.status, payload: readModelPayload(safe), rawText };
  } catch {
    return { status: response.status, payload: null, rawText };
  }
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: code, message }, { status });
}

export function instructSparkBody(goal: string, imageDataUrl: string) {
  return buildSparkResponsesBody({
    instruction: goalInstruction(goal),
    imageDataUrl,
  });
}

export async function handleInstructRequest(request: Request, deps: InstructDeps = {}): Promise<Response> {
  if (!deps.skipGuard) {
    const blocked = guardMetaRoute(request);
    if (blocked) return blocked;
  }
  let raw: unknown;
  try {
    const text = await readLimitedBody(request, Math.ceil(INSTRUCT_STILL_MAX_BYTES * 4 / 3) + 4096);
    if (text === null) return jsonError(413, "image_too_large", "Use a smaller workspace still.");
    raw = JSON.parse(text);
  } catch {
    return jsonError(400, "invalid_json", "The request was not JSON.");
  }
  const parsed = validateInstructInput(raw);
  if (!parsed.ok) return jsonError(parsed.status, parsed.code, parsed.message);
  // Screen before the daily cap and before any model fetch.
  const screened = screenGoal(parsed.value.goal);
  if (screened) {
    return Response.json({
      refused: true,
      reason: screened.reason,
      tutorial: null,
      schemaValid: false,
      parseOk: true,
      errors: [],
      mode: readModelApiKey(deps.env ?? process.env) ? "live" : "mock",
      modelId: SPARK_MODEL_ID,
      inputKind: "instruct",
      toolCalls: [],
      latencyMs: 0,
    });
  }
  const env = deps.env ?? process.env;
  const execution = modelExecutionMode(env, "instruct");
  if (!deps.ask && !deps.skipForward && execution === "forward") {
    const reserved = consumeMetaCalls(1);
    if (!reserved.ok) {
      return dailyCapResponse(new DailyCapError(reserved.message))
        ?? Response.json({ error: "daily_cap", message: reserved.message }, { status: 429 });
    }
    return forwardMuseRequest({
      rawBody: JSON.stringify(parsed.value),
      env,
      route: "instruct",
      signal: request.signal,
      contentType: "application/json",
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
      fetchImpl: deps.fetchImpl,
    });
  }
  if (!deps.ask && !deps.skipForward && execution !== "direct") {
    return Response.json(musePublicDegrade("instruct"));
  }
  const sparkBody = instructSparkBody(parsed.value.goal, parsed.value.imageDataUrl);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const ask = deps.ask ?? ((body) => askInstructModel(body, env, fetchImpl, request.signal));
  const started = performance.now();
  try {
    const reply = await ask(sparkBody);
    const mode = readModelApiKey(env) ? "live" : "mock";
    if (reply.status < 200 || reply.status >= 300) {
      return jsonError(502, "spark_failed", "Spark did not return a plan.");
    }
    if (reply.payload == null) {
      if (reply.rawText && looksLikeModelRefusal(reply.rawText)) {
        return Response.json({
          refused: true,
          reason: REFUSAL_UNSAFE,
          tutorial: null,
          schemaValid: false,
          parseOk: true,
          errors: [],
          mode,
          modelId: SPARK_MODEL_ID,
          inputKind: "instruct",
          toolCalls: [],
          latencyMs: 0,
        });
      }
      return Response.json({
        mode,
        modelId: SPARK_MODEL_ID,
        latencyMs: 0,
        schemaValid: false,
        parseOk: false,
        errors: ["The plan was not JSON."],
        tutorial: null,
        toolCalls: [],
        inputKind: "instruct",
        debug: instructDebugText(reply.rawText ?? "", [readModelApiKey(env)]),
      }, { status: 422 });
    }
    const result = normalizeInstructPayload(reply.payload, parsed.value.goal, mode, Math.round(performance.now() - started), reply.rawText);
    if (!result.schemaValid && result.debug === undefined && reply.rawText) {
      result.debug = instructDebugText(reply.rawText, [readModelApiKey(env)]);
    } else if (result.debug) {
      result.debug = instructDebugText(result.debug, [readModelApiKey(env)]);
    }
    if (result.refused) {
      return Response.json({
        refused: true,
        reason: result.refusalReason,
        tutorial: null,
        schemaValid: false,
        parseOk: true,
        errors: [],
        mode: result.mode,
        modelId: result.modelId,
        inputKind: "instruct",
        toolCalls: [],
        latencyMs: result.latencyMs,
      });
    }
    return Response.json(result, { status: result.schemaValid ? 200 : 422 });
  } catch (error) {
    const capped = dailyCapResponse(error);
    if (capped) return capped;
    const message = error instanceof Error ? error.message : "Spark did not return a plan.";
    return jsonError(502, "spark_failed", redactSecrets(message, [readModelApiKey(env)]) || "Spark did not return a plan.");
  }
}

export const instructStillWidth = INSTRUCT_STILL_WIDTH;
