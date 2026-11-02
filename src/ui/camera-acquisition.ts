export function createCameraAcquisition() {
  let generation = 0;
  let current: MediaStream | null = null;
  let cancelPending: (() => void) | null = null;
  function stop() {
    generation++;
    cancelPending?.();
    cancelPending = null;
    current?.getTracks().forEach((track) => track.stop());
    current = null;
  }
  function acquire(open: (signal: AbortSignal) => Promise<MediaStream>, options: { timeoutMs?: number } = {}): Promise<MediaStream | null> {
    stop();
    const request = generation;
    const controller = new AbortController();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (stream: MediaStream | null, error?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (generation === request) cancelPending = null;
        if (error) reject(error); else resolve(stream);
      };
      const timer = setTimeout(() => {
        generation++;
        cancelPending = null;
        controller.abort();
        finish(null, new Error("Camera permission timed out. Try again or use a recorded sample."));
      }, options.timeoutMs ?? 20_000);
      cancelPending = () => { controller.abort(); finish(null); };
      // Attach handlers immediately: a late permission grant still owns real tracks.
      try {
        open(controller.signal).then((stream) => {
          if (generation !== request || settled) { stream.getTracks().forEach((track) => track.stop()); return; }
          current = stream;
          finish(stream);
        }, (error) => { if (generation === request) finish(null, error); });
      } catch (error) { finish(null, error); }
    });
  }
  return { acquire, stop };
}
