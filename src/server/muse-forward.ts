import { SPARK_MODEL_ID } from "@/src/models";
import { segmentTooLargeResponse } from "./segment-run";
import { SAM_FORWARD_SECRET_HEADER } from "./sam-forward";
import type { SparkResult } from "./types";
import { readLimitedBody } from "./request-body";
import { modelDeadline } from "./model-deadline";

/** Same byte cap shape as the segment forward, sized for a clip's JSON body. */
export const MUSE_MAX_BODY_BYTES = 32 * 1024 * 1024;
export const MUSE_FORWARD_TIMEOUT_MS = 60_000;

export const INTERNAL_INSTRUCT_PATH = "/api/internal/instruct";
export const INTERNAL_SPARK_PATH = "/api/internal/spark";

export type MuseForwardRoute = "instruct" | "spark";

/**
 * On only when the flag is exactly `1`, the shared forward URL ends at the
 * segment path, and the shared secret is set. Default off.
 */
export function museForwardEnabled(env: Record<string, string | undefined>): boolean {
  return env.MUSE_FORWARD_ENABLED === "1" && museForwardUrl(env, "spark") !== null && Boolean(env.SAM_FORWARD_SECRET?.trim());
}

/**
 * Sibling of SAM_FORWARD_URL. No separate Muse URL: the segment path is
 * replaced with /api/internal/instruct or /api/internal/spark.
 */
export function museForwardUrl(env: Record<string, string | undefined>, route: MuseForwardRoute): string | null {
  const sam = env.SAM_FORWARD_URL?.trim() ?? "";
  const base = sam.replace(/\/api\/internal\/segment\/?$/, "");
  if (!base || base === sam) return null;
  return `${base}/api/internal/${route}`;
}

export function museSecretRejected(): Response {
  return new Response(null, {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}

export function museTooLargeResponse(): Response {
  return segmentTooLargeResponse();
}

/** Public instruct and spark when forwarding is off. No model call. */
export function musePublicDegrade(inputKind: SparkResult["inputKind"]): SparkResult {
  return {
    mode: "degraded",
    modelId: null,
    latencyMs: 0,
    schemaValid: false,
    parseOk: false,
    errors: [],
    tutorial: null,
    toolCalls: [],
    inputKind,
  };
}

/** Null when the declared or actual body is over the Muse forward limit. */
export async function readMuseBody(request: Request): Promise<string | null> {
  return readLimitedBody(request, MUSE_MAX_BODY_BYTES);
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

export async function forwardMuseRequest(options: {
  rawBody: string;
  env: Record<string, string | undefined>;
  route: MuseForwardRoute;
  contentType?: string | null;
  forwardedFor?: string | null;
  realIp?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<Response> {
  const url = museForwardUrl(options.env, options.route) ?? "";
  const secret = options.env.SAM_FORWARD_SECRET ?? "";
  const timeoutMs = options.timeoutMs ?? MUSE_FORWARD_TIMEOUT_MS;
  const deadline = modelDeadline(timeoutMs, options.signal);
  try {
    const headers: Record<string, string> = {
      "Content-Type": options.contentType?.trim() || "application/json",
      [SAM_FORWARD_SECRET_HEADER]: secret,
    };
    if (options.forwardedFor) headers["x-forwarded-for"] = options.forwardedFor;
    if (options.realIp) headers["x-real-ip"] = options.realIp;
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await deadline.run(() => fetchImpl(url, {
      method: "POST",
      headers,
      body: options.rawBody,
      redirect: "manual",
      signal: deadline.signal,
    }));
    const body = await deadline.run(() => response.arrayBuffer());
    const outHeaders = new Headers();
    const type = response.headers.get("content-type");
    if (type) outHeaders.set("content-type", type);
    return new Response(body, { status: response.status, headers: outHeaders });
  } catch (error) {
    const timedOut = isAbort(error);
    console.error(timedOut ? "Muse forward timed out" : "Muse forward failed");
    return Response.json({
      error: "spark_failed",
      message: timedOut ? "Spark timed out." : "Spark did not return a plan.",
      modelId: SPARK_MODEL_ID,
    }, { status: 502 });
  } finally {
    deadline.close();
  }
}
