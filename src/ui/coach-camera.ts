/** Do not call a camera live until playback and a decodable frame are available. */
export async function readyCoachCamera(
  video: HTMLVideoElement,
  stream: MediaStream,
  options: { timeoutMs: number; signal?: AbortSignal },
): Promise<void> {
  video.srcObject = stream;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectStop: (error: Error) => void = () => {};
  let resolveFrame: () => void = () => {};
  const usable = () => { if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) resolveFrame(); };
  const abort = () => rejectStop(new DOMException("Camera cancelled", "AbortError"));
  const failed = () => rejectStop(new Error("Camera playback is unavailable."));
  const stopped = new Promise<never>((_, reject) => {
    rejectStop = reject;
    timer = setTimeout(() => reject(new DOMException("Camera did not produce a frame.", "TimeoutError")), options.timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    video.addEventListener("error", failed);
  });
  const frame = new Promise<void>((resolve) => {
    resolveFrame = resolve;
    video.addEventListener("loadeddata", usable);
    video.addEventListener("canplay", usable);
    usable();
  });
  try {
    await Promise.race([Promise.all([video.play(), frame]), stopped]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    video.removeEventListener("error", failed);
    video.removeEventListener("loadeddata", usable);
    video.removeEventListener("canplay", usable);
  }
}
