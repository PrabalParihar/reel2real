import type { SparkRequest, SparkResult } from "@/src/server/types";
import { validateTutorialSteps } from "@/src/schema/validate";
import type { PrepareRequest } from "./session";

export type ExtractStage = "upload" | "reading" | "validating" | "preparing";
export interface SparkRequestOptions {
  signal?: AbortSignal;
  /** Per-subscriber deadline, capped by the total transport deadline. */
  timeoutMs?: number;
}

const TOTAL_DEADLINE_MS = 45_000;

interface Subscriber {
  resolve: (result: SparkResult) => void;
  reject: (error: Error) => void;
  onStage?: (stage: ExtractStage) => void;
  cleanup: () => void;
}

interface InflightRequest {
  xhr: XMLHttpRequest;
  subscribers: Set<Subscriber>;
  stage: ExtractStage;
  settled: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

// This is a transport registry, never a result cache. Identity includes every
// field sent to Spark, including attribution and any edited metadata.
const inflight = new Map<string, InflightRequest>();

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function requestBody(prepare: PrepareRequest): string {
  const payload: SparkRequest = {
    transcript: prepare.transcript,
    title: prepare.title,
    domain: prepare.domain,
    filename: prepare.filename,
    durationSec: prepare.durationSec,
    sampleId: prepare.sampleId,
    videoBase64: prepare.videoBase64,
    mimeType: prepare.mimeType,
    creatorName: prepare.creatorName,
    licenceChoice: prepare.licenceChoice,
    creditLink: prepare.creditLink,
  };
  return JSON.stringify(payload);
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseSparkResult(input: unknown): SparkResult {
  const value: unknown = typeof input === "string" ? JSON.parse(input) : input;
  if (!record(value)
    || typeof value.mode !== "string" || !["live", "mock", "degraded"].includes(value.mode)
    || !(value.modelId === null || typeof value.modelId === "string")
    || typeof value.latencyMs !== "number" || !Number.isFinite(value.latencyMs) || value.latencyMs < 0
    || typeof value.schemaValid !== "boolean" || typeof value.parseOk !== "boolean"
    || !Array.isArray(value.errors) || !value.errors.every((error) => typeof error === "string")
    || typeof value.inputKind !== "string" || !["clip", "transcript", "sample", "instruct"].includes(value.inputKind)
    || !Array.isArray(value.toolCalls)
    || !value.toolCalls.every((call: unknown) => record(call)
      && typeof call.tool === "string" && ["muse_spark", "sam_3_1", "tts", "other"].includes(call.tool)
      && typeof call.modelId === "string" && typeof call.purpose === "string")
    || (value.refused !== undefined && typeof value.refused !== "boolean")
    || (value.refusalReason !== undefined && typeof value.refusalReason !== "string")
    || !(value.tutorial === null || record(value.tutorial))
    || (value.schemaValid && (!value.parseOk || value.tutorial === null))) {
    throw new Error("Spark returned an invalid response.");
  }
  if (value.tutorial !== null) {
    const validated = validateTutorialSteps(value.tutorial);
    if (!validated.ok) throw new Error("Spark returned invalid tutorial steps.");
    value.tutorial = validated.value;
  }
  return value as unknown as SparkResult;
}

function emit(subscriber: Subscriber, stage: ExtractStage) {
  // Consumer progress rendering must not prevent the transport from settling.
  try { subscriber.onStage?.(stage); } catch { /* isolated consumer callback */ }
}

function finish(key: string, entry: InflightRequest, result: SparkResult | Error) {
  if (entry.settled) return;
  entry.settled = true;
  clearTimeout(entry.timer);
  if (inflight.get(key) === entry) inflight.delete(key);
  for (const subscriber of entry.subscribers) {
    subscriber.cleanup();
    if (result instanceof Error) subscriber.reject(result);
    else subscriber.resolve(result);
  }
  entry.subscribers.clear();
}

function releaseIfUnused(key: string, entry: InflightRequest) {
  // React Strict Mode tears down and reattaches effects in the same task.
  // Keep that window available without keeping cancelled work alive later.
  queueMicrotask(() => {
    if (!entry.settled && entry.subscribers.size === 0) {
      finish(key, entry, namedError("AbortError", "Spark extraction was cancelled."));
      entry.xhr.abort();
    }
  });
}

function subscribe(key: string, entry: InflightRequest, onStage: Subscriber["onStage"], options: SparkRequestOptions): Promise<SparkResult> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscriber: Subscriber = {
      resolve, reject, onStage,
      cleanup: () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      },
    };
    const cancel = (error: Error) => {
      if (!entry.subscribers.delete(subscriber)) return;
      subscriber.cleanup();
      reject(error);
      releaseIfUnused(key, entry);
    };
    const abort = () => cancel(namedError("AbortError", "Spark extraction was cancelled."));
    entry.subscribers.add(subscriber);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.timeoutMs !== undefined && Number.isFinite(options.timeoutMs)) {
      const deadline = Math.max(1, Math.min(options.timeoutMs, TOTAL_DEADLINE_MS));
      timer = setTimeout(() => cancel(namedError("TimeoutError", "Spark extraction timed out. Try again.")), deadline);
    }
    emit(subscriber, entry.stage);
  });
}

export function postSpark(prepare: PrepareRequest, onStage?: (stage: ExtractStage) => void, options: SparkRequestOptions = {}): Promise<SparkResult> {
  if (options.signal?.aborted) return Promise.reject(namedError("AbortError", "Spark extraction was cancelled."));
  let key: string;
  let xhr: XMLHttpRequest;
  try {
    key = requestBody(prepare);
    const existing = inflight.get(key);
    if (existing) return subscribe(key, existing, onStage, options);
    xhr = new XMLHttpRequest();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error("Spark request could not start."));
  }
  const entry: InflightRequest = { xhr, subscribers: new Set(), stage: prepare.hasClip ? "upload" : "reading", settled: false };
  inflight.set(key, entry);
  const promise = subscribe(key, entry, onStage, options);
  if (entry.subscribers.size === 0) {
    // An initial progress callback may cancel before the transport has started.
    finish(key, entry, namedError("AbortError", "Spark extraction was cancelled."));
    return promise;
  }
  const progress = (stage: ExtractStage) => {
    if (entry.settled) return;
    entry.stage = stage;
    for (const subscriber of entry.subscribers) emit(subscriber, stage);
  };
  const timeout = () => {
    finish(key, entry, namedError("TimeoutError", "Spark extraction timed out. Try again."));
    xhr.abort();
  };

  try {
    xhr.open("POST", "/api/spark");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.timeout = TOTAL_DEADLINE_MS;
    xhr.upload.onprogress = () => progress(prepare.hasClip ? "upload" : "reading");
    xhr.upload.onload = () => progress("reading");
    xhr.onload = () => {
      if (entry.settled) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(`Spark failed (HTTP ${xhr.status}).`) as Error & { status: number; code?: string };
        error.status = xhr.status;
        try {
          const parsed: unknown = JSON.parse(xhr.responseText);
          if (record(parsed)) {
            if (typeof parsed.error === "string") error.code = parsed.error;
            if (typeof parsed.message === "string" && parsed.message.trim()) error.message = parsed.message;
          }
        } catch { /* HTML and empty error bodies retain the HTTP status. */ }
        finish(key, entry, error);
        return;
      }
      try {
        finish(key, entry, parseSparkResult(xhr.responseText));
      } catch {
        finish(key, entry, new Error("Spark returned invalid steps JSON. Try again."));
      }
    };
    xhr.onerror = () => finish(key, entry, new Error("Spark did not return steps. Check your connection and try again."));
    xhr.onabort = () => finish(key, entry, namedError("AbortError", "Spark extraction was cancelled."));
    xhr.ontimeout = timeout;
    // The watchdog also covers environments that fail to deliver XHR timeout.
    entry.timer = setTimeout(timeout, TOTAL_DEADLINE_MS);
    xhr.send(key);
  } catch (error) {
    finish(key, entry, error instanceof Error ? error : new Error("Spark request could not start."));
  }
  return promise;
}
