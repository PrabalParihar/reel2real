type PreviewVideo = Pick<HTMLVideoElement, "readyState" | "videoWidth" | "play" | "addEventListener" | "removeEventListener">;

export function hasReadableInstructFrame(video: Pick<PreviewVideo, "readyState" | "videoWidth">): boolean {
  return video.readyState >= 2 && video.videoWidth > 0;
}

/** Observe an attached stream; readiness, expiry and disposal all release ownership. */
export function observeInstructPreview(video: PreviewVideo, callbacks: { onReady: () => void; onTimeout: () => void }): () => void {
  const events = ["loadedmetadata", "loadeddata", "canplay", "playing", "resize", "timeupdate"];
  let active = true;
  // Install the deadline before checking an already-readable frame, so it is
  // always cleared before onReady can trigger capture or other cleanup.
  const timer = setTimeout(() => {
    if (!active) return;
    dispose();
    callbacks.onTimeout();
  }, 8_000);

  function dispose() {
    active = false;
    clearTimeout(timer);
    events.forEach((event) => video.removeEventListener(event, retryPlayback));
  }

  function checkReady() {
    if (!active || !hasReadableInstructFrame(video)) return false;
    dispose();
    callbacks.onReady();
    return true;
  }

  function retryPlayback() {
    if (!active || checkReady()) return;
    // Autoplay can be rejected while media is still becoming readable. Media
    // events retry playback, and only the first-frame deadline reports failure.
    try {
      void video.play().then(checkReady, checkReady);
    } catch {
      // A synchronous playback failure follows the same bounded recovery path.
    }
  }

  events.forEach((event) => video.addEventListener(event, retryPlayback));
  retryPlayback();
  return dispose;
}
