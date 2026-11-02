import { describe, expect, it } from "vitest";
import { prepareStepPlayback } from "./source-playback";
function fakeVideo() {
  return Object.assign(new EventTarget(), { currentTime: 0, duration: 30, readyState: 2, paused: true, play: async function () { this.paused = false; }, pause: function () { this.paused = true; } }) as unknown as HTMLVideoElement;
}
describe("per-step source replay", () => {
  it("seeks each step separately and pauses at its range end", async () => {
    const video = fakeVideo();
    const first = prepareStepPlayback(video, { startSec: 2, endSec: 4 });
    expect(video.currentTime).toBe(2);
    await first.replay();
    expect(video.paused).toBe(false);
    video.currentTime = 4.1;
    video.dispatchEvent(new Event("timeupdate"));
    expect(video.paused).toBe(true);
    first.dispose();
    const next = prepareStepPlayback(video, { startSec: 8, endSec: 10 });
    expect(video.currentTime).toBe(8);
    next.dispose();
  });
  it("returns usable failure feedback for blocked source playback", async () => {
    const video = fakeVideo();
    video.play = async () => { throw new Error("unsupported codec"); };
    const playback = prepareStepPlayback(video, { startSec: 2, endSec: 4 });
    expect(await playback.replay()).toBe(false);
    playback.dispose();
  });
});
