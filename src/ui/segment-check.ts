import type { SegmentResult } from "@/src/server/types";

/** One deadline covers fetch and body decoding. Abort even if a transport ignores it. */
export async function runSegmentCheck(
  request: (signal: AbortSignal) => Promise<Response>,
  options: { timeoutMs: number; signal?: AbortSignal },
): Promise<SegmentResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const stopped = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(new DOMException("Check cancelled", "AbortError"));
    };
    if (options.signal?.aborted) onAbort();
    else options.signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new DOMException("Object check timed out. Recheck or continue manually.", "TimeoutError"));
    }, options.timeoutMs);
  });
  const response = async () => {
    if (controller.signal.aborted) throw new DOMException("Check cancelled", "AbortError");
    const response = await request(controller.signal);
    if (!response.ok) throw new Error(`Object check failed (HTTP ${response.status}).`);
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new Error("Invalid object check response.");
    const result = data as SegmentResult;
    if (!["live", "mock", "degraded"].includes(result.mode) || typeof result.ok !== "boolean" || typeof result.timedOut !== "boolean" || !Array.isArray(result.masks) || !result.toolCall || typeof result.toolCall !== "object") throw new Error("Invalid object check response.");
    for (const mask of result.masks) {
      if (!mask || typeof mask.objectId !== "string" || typeof mask.noun !== "string" || typeof mask.present !== "boolean") throw new Error("Invalid object check masks.");
      if (mask.box) {
        const { x, y, w, h } = mask.box;
        if (![x, y, w, h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 1.001 || y + h > 1.001) throw new Error("Invalid object check box.");
      }
    }
    return result;
  };
  try {
    return await Promise.race([response(), stopped]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/** Invalidate obsolete work synchronously when a learner navigates or rechecks. */
export class SegmentCheckScope {
  private controller: AbortController | null = null;

  begin() {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () => this.controller === controller && !controller.signal.aborted,
      finish: () => { if (this.controller === controller) this.controller = null; },
    };
  }

  cancel() {
    this.controller?.abort();
    this.controller = null;
  }
}
