import { createHash, timingSafeEqual } from "node:crypto";
import { TIMEOUTS } from "@/src/fsm/types";
import type { SegmentResult } from "@/src/server/types";

export const SAM_FORWARD_SECRET_HEADER = "x-r2r-forward-secret";

const MAX_PROMPTS = 4;

/** On only when the flag is exactly `1` and a forward URL is set. */
export function samForwardEnabled(env: Record<string, string | undefined>): boolean {
  return env.SAM_FORWARD_ENABLED === "1" && Boolean(env.SAM_FORWARD_URL?.trim());
}

/** SHA-256 then timingSafeEqual, so length differences do not throw or return early. */
export function secretsEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * False when the env secret is unset, the header is missing, or the header does not match.
 * Callers answer that with an empty 404.
 */
export function forwardSecretOk(header: string | null, env: Record<string, string | undefined>): boolean {
  const expected = env.SAM_FORWARD_SECRET;
  if (expected == null || expected === "" || header == null || header === "") return false;
  return secretsEqual(header, expected);
}

/** Failed segment with no model call. The coach maps the error to Highlights unavailable. */
export function samForwardDegrade(input: {
  timedOut: boolean;
  inputKind?: "image" | "video_chunk";
  latencyMs?: number;
}): SegmentResult {
  const inputKind = input.inputKind === "video_chunk" ? "video_chunk" : "image";
  const latencyMs = input.latencyMs ?? 0;
  return {
    mode: "degraded",
    modelId: null,
    latencyMs,
    ok: false,
    timedOut: input.timedOut,
    error: input.timedOut ? "SAM timed out." : "SAM request failed",
    inputKind,
    masks: [],
    toolCall: {
      tool: "sam_3_1",
      modelId: null,
      purpose: "keyframe_object_masks",
      inputKind,
      latencyMs,
    },
  };
}

function inputKindOf(rawBody: string): "image" | "video_chunk" {
  try {
    const parsed = JSON.parse(rawBody) as { inputKind?: unknown };
    return parsed.inputKind === "video_chunk" ? "video_chunk" : "image";
  } catch {
    return "image";
  }
}

/** Long enough for the same per-prompt cap the direct segment call uses. */
export function samForwardTimeoutMs(rawBody: string): number {
  let per: number = TIMEOUTS.SAM_TIMEOUT_MS;
  let count = 1;
  try {
    const parsed = JSON.parse(rawBody) as { timeoutMs?: unknown; prompts?: unknown };
    if (typeof parsed.timeoutMs === "number" && Number.isFinite(parsed.timeoutMs) && parsed.timeoutMs > 0) {
      per = Math.min(parsed.timeoutMs, TIMEOUTS.SAM_TIMEOUT_MS);
    }
    if (Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
      count = Math.min(parsed.prompts.length, MAX_PROMPTS);
    }
  } catch {
    return TIMEOUTS.SAM_TIMEOUT_MS;
  }
  return per * count;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export async function forwardSamRequest(options: {
  rawBody: string;
  env: Record<string, string | undefined>;
  contentType?: string | null;
  forwardedFor?: string | null;
  realIp?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<Response> {
  const url = options.env.SAM_FORWARD_URL?.trim() ?? "";
  const secret = options.env.SAM_FORWARD_SECRET ?? "";
  const timeoutMs = options.timeoutMs ?? samForwardTimeoutMs(options.rawBody);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": options.contentType?.trim() || "application/json",
      [SAM_FORWARD_SECRET_HEADER]: secret,
    };
    if (options.forwardedFor) headers["x-forwarded-for"] = options.forwardedFor;
    if (options.realIp) headers["x-real-ip"] = options.realIp;
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: options.rawBody,
      redirect: "manual",
      signal: controller.signal,
    });
    const body = await response.arrayBuffer();
    const outHeaders = new Headers();
    const type = response.headers.get("content-type");
    if (type) outHeaders.set("content-type", type);
    return new Response(body, { status: response.status, headers: outHeaders });
  } catch (error) {
    const timedOut = isAbort(error);
    const latencyMs = Math.round(performance.now() - started);
    console.error(timedOut ? "SAM forward timed out" : "SAM forward failed");
    return Response.json(samForwardDegrade({
      timedOut,
      inputKind: inputKindOf(options.rawBody),
      latencyMs,
    }));
  } finally {
    clearTimeout(timer);
  }
}
