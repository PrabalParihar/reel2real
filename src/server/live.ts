import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { SAM_MODEL_ID, SPARK_MODEL_ID, API_ORIGIN } from "@/src/models";
import { tutorialFromSparkPayload, type UserAttribution } from "@/src/schema/attribution";
import { parseSamBoxes } from "./sam-parse";
import { buildSamResponsesBody, responsesUrl, samMaskPresent, samOutputText, samRequestHeaders } from "./sam-request";
import { metaUpstreamLog, pathnameOf, readUpstreamHeaders, samFailureLog, sparkFailureLog } from "./meta-log";
import { redactSecrets } from "./redact";
import { buildSparkResponsesBody, chooseSparkMediaPlan, SPARK_STEPS_INSTRUCTION } from "./spark-request";
import { sampleById } from "./fixtures";
import { consumeMetaCalls, DailyCapError } from "./daily-cap";
import { modelDeadline, type ModelDeadline } from "./model-deadline";
import { CLIP_MAX_BYTES, SEGMENT_MAX_BYTES, decodeModelMedia, validateClipDuration } from "./model-media";
import type { SegmentRequest, SegmentResult, SegmentationClient, SparkClient, SparkRequest, SparkResult, MaskHit } from "./types";

function assertServer() {
  if (typeof window !== "undefined") throw new Error("Model clients are server-only");
}

function reserveMetaCall() {
  const result = consumeMetaCalls();
  if (!result.ok) throw new DailyCapError(result.message);
}

function modelFromBody(body: unknown): string {
  if (body && typeof body === "object" && "model" in body) {
    const model = (body as { model?: unknown }).model;
    if (typeof model === "string" && model) return model;
  }
  return "-";
}

async function postResponses(
  key: string,
  body: unknown,
  deadline: ModelDeadline,
  headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
): Promise<{ status: number; text: string; url: string; requestId: string; route: string; latencyMs: number }> {
  deadline.throwIfExpired();
  reserveMetaCall();
  const url = responsesUrl(process.env);
  const started = performance.now();
  return deadline.run(async () => {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: deadline.signal,
    });
    const text = await response.text();
    const ids = readUpstreamHeaders(response.headers);
    const latencyMs = Math.round(performance.now() - started);
    const model = modelFromBody(body);
    const ok = response.status >= 200 && response.status < 300;
    const line = ok
      ? metaUpstreamLog({ path: pathnameOf(url), model, status: response.status, requestId: ids.requestId, route: ids.route, latencyMs })
      : model === SAM_MODEL_ID
        ? samFailureLog({ status: response.status, url, body: text, requestId: ids.requestId, route: ids.route, latencyMs, model, secrets: [key] })
        : sparkFailureLog({ status: response.status, url, body: text, requestId: ids.requestId, route: ids.route, latencyMs, model, secrets: [key] });
    console.error(line);
    return { status: response.status, text: redactSecrets(text, [key]), url, requestId: ids.requestId, route: ids.route, latencyMs };
  });
}

function outputText(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    };
    if (typeof parsed.output_text === "string") return parsed.output_text;
    const chunks: string[] = [];
    for (const item of parsed.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === "string") chunks.push(part.text);
      }
    }
    return chunks.join("\n");
  } catch {
    return payload;
  }
}

function jsonFromText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Spark response did not contain JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const FILES_URL = `${API_ORIGIN}/v1/files`;
const SPARK_TIMEOUT_MS = 45000;

function userMeta(input: SparkRequest): UserAttribution | null {
  if (!input.creatorName?.trim() || !input.licenceChoice) return null;
  return { creatorName: input.creatorName, licence: input.licenceChoice, creditLink: input.creditLink };
}

function fail(latencyMs: number, errors: string[], inputKind: SparkResult["inputKind"]): SparkResult {
  return {
    mode: "live",
    modelId: SPARK_MODEL_ID,
    latencyMs,
    schemaValid: false,
    parseOk: false,
    errors,
    tutorial: null,
    toolCalls: [],
    inputKind,
  };
}

async function finishPayload(
  payload: unknown,
  meta: UserAttribution,
  input: SparkRequest,
  latencyMs: number,
  inputKind: SparkResult["inputKind"],
): Promise<SparkResult> {
  const toolCalls = [
    {
      tool: "muse_spark" as const,
      modelId: SPARK_MODEL_ID,
      purpose: inputKind === "clip" ? "tutorial_clip_to_steps_json" : "tutorial_transcript_to_steps_json",
      inputKind: inputKind === "clip" ? "clip" as const : "transcript" as const,
      latencyMs,
    },
  ];
  // Only actual model responses receive app-owned identity and execution provenance.
  // Curated samples use this function for attribution too, and retain recorded metadata.
  if (inputKind === "clip" || inputKind === "transcript") {
    if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
        typeof (payload as Record<string, unknown>).schemaVersion !== "string") {
      return { ...fail(latencyMs, ["A versioned tutorial JSON object is required."], inputKind), parseOk: true, toolCalls };
    }
    const draft = structuredClone(payload) as Record<string, unknown>;
    if (!("tutorialId" in draft)) draft.tutorialId = `live_${randomUUID()}`;
    draft.generation = { mode: "muse_spark_live", modelId: SPARK_MODEL_ID, toolCalls };
    if (inputKind === "clip") {
      const source = draft.sourceClip;
      draft.sourceClip = {
        ...(source && typeof source === "object" && !Array.isArray(source) ? source : {}),
        mediaType: input.mimeType || "video/mp4",
        durationSec: input.durationSec,
        stillPlaceholder: false,
      };
    }
    payload = draft;
  }
  const normalized = tutorialFromSparkPayload(payload, meta, {
    title: input.title,
    domain: input.domain,
    filename: input.filename,
    durationSec: input.durationSec,
    mode: "muse_spark_live",
  });
  if (!normalized.ok) {
    return {
      mode: "live",
      modelId: SPARK_MODEL_ID,
      latencyMs,
      schemaValid: false,
      parseOk: true,
      errors: normalized.errors.map((error) => error.message),
      tutorial: null,
      toolCalls,
      inputKind,
    };
  }
  if (inputKind === "clip" || inputKind === "transcript") normalized.value.generation.toolCalls = toolCalls;
  return {
    mode: "live",
    modelId: SPARK_MODEL_ID,
    latencyMs,
    schemaValid: true,
    parseOk: true,
    errors: [],
    tutorial: normalized.value,
    toolCalls,
    inputKind,
  };
}

async function uploadClipFile(key: string, base64: string, mime: string, deadline: ModelDeadline): Promise<{ id?: string; status: number }> {
  deadline.throwIfExpired();
  reserveMetaCall();
  const started = performance.now();
  const bytes = Buffer.from(base64, "base64");
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), mime.includes("webm") ? "clip.webm" : "clip.mp4");
  return deadline.run(async () => {
    const response = await fetch(FILES_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: deadline.signal,
    });
    const ids = readUpstreamHeaders(response.headers);
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      const text = await response.text();
      console.error(sparkFailureLog({
        status: response.status,
        url: FILES_URL,
        body: text,
        requestId: ids.requestId,
        route: ids.route,
        latencyMs,
        model: "-",
        secrets: [key],
      }));
      return { status: response.status };
    }
    console.error(metaUpstreamLog({
      path: "/v1/files",
      model: "-",
      status: response.status,
      requestId: ids.requestId,
      route: ids.route,
      latencyMs,
    }));
    const payload = (await response.json()) as { id?: string };
    return { id: payload.id, status: response.status };
  });
}

export function createLiveSparkClient(key: string): SparkClient {
  assertServer();
  return {
    mode: "live",
    modelId: SPARK_MODEL_ID,
    async generateSteps(input: SparkRequest): Promise<SparkResult> {
      const started = performance.now();
      const deadline = modelDeadline(SPARK_TIMEOUT_MS, input.signal);
      const meta = userMeta(input);
      try {
        if (!input.videoBase64) {
          if (input.sampleId && !input.transcript) {
            const curated = sampleById(input.sampleId);
            const owned = meta
              ? (await finishPayload(curated, meta, input, 0, "sample")).tutorial
              : curated;
            return {
              mode: "live",
              modelId: SPARK_MODEL_ID,
              latencyMs: Math.round(performance.now() - started),
              schemaValid: true,
              parseOk: true,
              errors: [],
              tutorial: owned,
              toolCalls: curated.generation.toolCalls,
              inputKind: "sample",
            };
          }
          if (!meta) return fail(0, ["Creator name and licence are required."], "transcript");
          const response = await postResponses(key, buildSparkResponsesBody({ transcript: input.transcript || input.title || "Tutorial" }), deadline);
          const latencyMs = Math.round(performance.now() - started);
          if (response.status < 200 || response.status >= 300) {
            return fail(latencyMs, [`Spark failed (HTTP ${response.status}).`], "transcript");
          }
          try {
            return await finishPayload(jsonFromText(outputText(response.text)), meta, input, latencyMs, "transcript");
          } catch {
            return fail(latencyMs, ["Spark JSON could not be parsed."], "transcript");
          }
        }
        if (!meta) return fail(0, ["Creator name and licence are required."], "clip");
        const mime = input.mimeType || "video/mp4";
        validateClipDuration(input.durationSec);
        const bytes = decodeModelMedia(input.videoBase64, mime, "video_chunk", CLIP_MAX_BYTES).length;
        const plan = chooseSparkMediaPlan({ durationSec: input.durationSec, byteLength: bytes });
        let dataUrlError = "";
        if (plan === "full_video_data_url") {
          const response = await postResponses(
            key,
            buildSparkResponsesBody({ instruction: SPARK_STEPS_INSTRUCTION, videoBase64: input.videoBase64, mimeType: mime }),
            deadline,
          );
          const latencyMs = Math.round(performance.now() - started);
          if (response.status >= 200 && response.status < 300) {
            try {
              return await finishPayload(jsonFromText(outputText(response.text)), meta, input, latencyMs, "clip");
            } catch {
              return fail(latencyMs, ["Spark JSON could not be parsed."], "clip");
            }
          }
          if (response.status !== 413 && response.status !== 400) {
            return fail(latencyMs, [`Spark failed (HTTP ${response.status}).`], "clip");
          }
          dataUrlError = `HTTP ${response.status}`;
        }
        const uploaded = await uploadClipFile(key, input.videoBase64, mime, deadline);
        if (!uploaded.id) {
          const latencyMs = Math.round(performance.now() - started);
          const both = dataUrlError ? "The short upload and the files upload both failed." : `Files upload failed (HTTP ${uploaded.status}).`;
          return fail(latencyMs, [both], "clip");
        }
        const response = await postResponses(
          key,
          buildSparkResponsesBody({ instruction: SPARK_STEPS_INSTRUCTION, fileId: uploaded.id }),
          deadline,
        );
        const latencyMs = Math.round(performance.now() - started);
        if (response.status < 200 || response.status >= 300) {
          return fail(latencyMs, [dataUrlError ? "The short upload and the files upload both failed." : `Spark failed (HTTP ${response.status}).`], "clip");
        }
        try {
          return await finishPayload(jsonFromText(outputText(response.text)), meta, input, latencyMs, "clip");
        } catch {
          return fail(latencyMs, ["Spark JSON could not be parsed."], "clip");
        }
      } catch (error) {
        if (error instanceof DailyCapError) throw error;
        const latencyMs = Math.round(performance.now() - started);
        const message = error instanceof Error ? error.message : "Spark request failed";
        return fail(latencyMs, [redactSecrets(message, [key]) || "Spark request failed"], input.videoBase64 ? "clip" : "transcript");
      } finally {
        deadline.close();
      }
    },
  };
}

function dataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}


export function createLiveSegmentationClient(key: string): SegmentationClient {
  assertServer();
  return {
    mode: "live",
    modelId: SAM_MODEL_ID,
    async segment(input: SegmentRequest): Promise<SegmentResult> {
      const started = performance.now();
      const deadline = modelDeadline(Number.isFinite(input.timeoutMs) && input.timeoutMs > 0 ? Math.min(input.timeoutMs, 8000) : 8000, input.signal);
      const prompts = input.prompts;
      const masks: MaskHit[] = [];
      let status = 0;
      let failed = "";
      try {
        deadline.throwIfExpired();
        if (!prompts.length || prompts.length > 4) throw new Error("SAM supports one to four object prompts per request.");
        const precisePrompts = prompts.map((prompt) => {
          const text = prompt.samPrompt?.trim() || prompt.noun?.trim();
          if (!text || text.length > 500) throw new Error("SAM object prompt must contain 1 to 500 characters.");
          return { ...prompt, text };
        });
        let base64 = input.mediaBase64;
        if (!base64 && input.mediaPath) {
          const info = await deadline.run(() => stat(input.mediaPath!));
          if (!info.isFile() || info.size > SEGMENT_MAX_BYTES) throw new Error("Media exceeds the supported byte limit.");
          const bytes = await deadline.run(() => readFile(input.mediaPath!, { signal: deadline.signal }));
          base64 = bytes.toString("base64");
        }
        if (!base64) throw new Error("No frame was attached");
        const mime = input.mimeType || (input.inputKind === "video_chunk" ? "video/mp4" : "image/jpeg");
        decodeModelMedia(base64, mime, input.inputKind, SEGMENT_MAX_BYTES);
        const encoded = dataUrl(mime, base64);
        // One Meta SAM call per noun. A 4-noun step is 4 calls. Instruct plans cap nouns at 3.
        for (const prompt of precisePrompts) {
          const response = await postResponses(
            key,
            input.inputKind === "video_chunk"
              ? buildSamResponsesBody({ prompt: prompt.text, videoDataUrl: encoded })
              : buildSamResponsesBody({ prompt: prompt.text, imageDataUrl: encoded }),
            deadline,
            samRequestHeaders(key),
          );
          status = response.status;
          if (response.status < 200 || response.status >= 300) {
            failed = `SAM failed (HTTP ${response.status}).`;
            break;
          }
          const text = samOutputText(response.text);
          const boxes = parseSamBoxes(text);
          const present = samMaskPresent(text);
          const candidateBox = boxes[0]?.box;
          const box = candidateBox && candidateBox.x + candidateBox.w <= 1 && candidateBox.y + candidateBox.h <= 1 ? candidateBox : undefined;
          masks.push({
            objectId: prompt.objectId,
            noun: prompt.noun,
            present,
            trackId: present && boxes[0] ? `f${boxes[0].frame}-o${boxes[0].ordinal}` : undefined,
            box,
          });
        }
        const latencyMs = Math.round(performance.now() - started);
        return {
          mode: "live",
          modelId: SAM_MODEL_ID,
          latencyMs,
          ok: !failed,
          timedOut: false,
          error: failed || undefined,
          httpStatus: status,
          inputKind: input.inputKind,
          masks,
          toolCall: {
            tool: "sam_3_1",
            modelId: SAM_MODEL_ID,
            purpose: input.inputKind === "video_chunk" ? "chunk_object_masks" : "keyframe_object_masks",
            inputKind: input.inputKind === "video_chunk" ? "video_chunk" : "image",
            latencyMs,
          },
        };
      } catch (error) {
        if (error instanceof DailyCapError) throw error;
        const latencyMs = Math.round(performance.now() - started);
        const timedOut = deadline.signal.aborted && deadline.signal.reason?.name === "TimeoutError";
        const message = timedOut ? "SAM timed out." : redactSecrets(error instanceof Error ? error.message : "SAM request failed", [key]);
        return {
          mode: "live",
          modelId: SAM_MODEL_ID,
          latencyMs,
          ok: false,
          timedOut,
          error: message,
          httpStatus: status || undefined,
          inputKind: input.inputKind,
          masks,
          toolCall: {
            tool: "sam_3_1",
            modelId: SAM_MODEL_ID,
            purpose: input.inputKind === "video_chunk" ? "chunk_object_masks" : "keyframe_object_masks",
            inputKind: input.inputKind === "video_chunk" ? "video_chunk" : "image",
            latencyMs,
          },
        };
      } finally {
        deadline.close();
      }
    },
  };
}
