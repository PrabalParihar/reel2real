/** One deadline covers media preparation, uploads, response bodies and all nouns. */
export function modelDeadline(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const expiresAt = Date.now() + timeoutMs;
  const throwIfExpired = () => {
    if (!controller.signal.aborted && Date.now() >= expiresAt) controller.abort(new DOMException("Model request timed out.", "TimeoutError"));
    controller.signal.throwIfAborted();
  };
  const abortFromParent = () => controller.abort(new DOMException("Model request cancelled.", "AbortError"));
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Model request timed out.", "TimeoutError")), timeoutMs);
  return {
    signal: controller.signal,
    throwIfExpired,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      throwIfExpired();
      let listener: (() => void) | undefined;
      const aborted = new Promise<never>((_resolve, reject) => {
        listener = () => reject(controller.signal.reason);
        controller.signal.addEventListener("abort", listener, { once: true });
      });
      try { return await Promise.race([operation(), aborted]); }
      finally { if (listener) controller.signal.removeEventListener("abort", listener); }
    },
    close() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

export type ModelDeadline = ReturnType<typeof modelDeadline>;
