import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";

export interface RuntimeInfo {
  mock: boolean;
  sparkModelId: string;
  samModelId: string;
  /** Configured routes; these do not assert upstream health or model quality. */
  capabilities?: { spark: boolean; instruct: boolean; segment: boolean };
}

const DISABLED = { spark: false, instruct: false, segment: false };
export const DEFAULT_RUNTIME: RuntimeInfo = {
  mock: true, sparkModelId: SPARK_MODEL_ID, samModelId: SAM_MODEL_ID, capabilities: DISABLED,
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseRuntime(value: unknown): RuntimeInfo {
  if (!record(value) || typeof value.mock !== "boolean"
    || typeof value.sparkModelId !== "string" || !value.sparkModelId.trim()
    || typeof value.samModelId !== "string" || !value.samModelId.trim()) {
    throw new Error("Runtime configuration is unavailable.");
  }
  const capabilities = value.capabilities;
  if (capabilities !== undefined && (!record(capabilities)
    || typeof capabilities.spark !== "boolean" || typeof capabilities.instruct !== "boolean"
    || typeof capabilities.segment !== "boolean")) {
    throw new Error("Runtime configuration is unavailable.");
  }
  // Older responses remain readable, but an absent capability never grants permission.
  return {
    mock: value.mock, sparkModelId: value.sparkModelId, samModelId: value.samModelId,
    capabilities: capabilities === undefined ? { ...DISABLED } : {
      spark: capabilities.spark as boolean, instruct: capabilities.instruct as boolean, segment: capabilities.segment as boolean,
    },
  };
}

/** The complete preflight, including body parsing, must settle before input work is enabled. */
export async function loadRuntime(signal?: AbortSignal): Promise<RuntimeInfo> {
  if (signal?.aborted) throw new DOMException("Runtime check cancelled.", "AbortError");
  const controller = new AbortController();
  const cancel = () => controller.abort(new DOMException("Runtime check cancelled.", "AbortError"));
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Runtime check timed out.", "TimeoutError")), 5_000);
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([(async () => {
      controller.signal.throwIfAborted();
      const response = await fetch("/api/runtime", { signal: controller.signal });
      controller.signal.throwIfAborted();
      if (!response.ok) throw new Error("Runtime configuration is unavailable.");
      const value: unknown = await response.json();
      controller.signal.throwIfAborted();
      return parseRuntime(value);
    })(), interrupted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    controller.signal.removeEventListener("abort", onAbort);
  }
}
