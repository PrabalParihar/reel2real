/** Native controls remain available; the replay action constrains the selected step. */
export function prepareStepPlayback(video: HTMLVideoElement, range: { startSec: number; endSec: number }) {
  const start = Math.max(0, Number.isFinite(range.startSec) ? range.startSec : 0);
  const end = Number.isFinite(range.endSec) && range.endSec > start ? range.endSec : Infinity;
  const seek = () => {
    video.pause();
    try { video.currentTime = Math.min(start, Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.01) : start); } catch { /* Native controls allow recovery from an unsupported seek. */ }
  };
  const stopAtEnd = () => { if (video.currentTime >= end) video.pause(); };
  video.addEventListener("loadedmetadata", seek);
  video.addEventListener("timeupdate", stopAtEnd);
  if (video.readyState >= 1) seek();
  return {
    replay: async () => {
      try {
        video.currentTime = start;
        await video.play();
        return true;
      } catch { return false; }
    },
    dispose: () => {
      video.pause();
      video.removeEventListener("loadedmetadata", seek);
      video.removeEventListener("timeupdate", stopAtEnd);
    },
  };
}
