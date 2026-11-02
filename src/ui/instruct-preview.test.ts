import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasReadableInstructFrame, observeInstructPreview } from "./instruct-preview";

class FakeVideo extends EventTarget {
  readyState = 0;
  videoWidth = 0;
  playCalls = 0;
  rejectPlayback = false;

  play() {
    this.playCalls++;
    return this.rejectPlayback ? Promise.reject(new Error("Autoplay blocked")) : Promise.resolve();
  }

  frame(event = "loadeddata") {
    this.readyState = 2;
    this.videoWidth = 640;
    this.dispatchEvent(new Event(event));
  }
}

describe("instruction first-frame preview", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("requires readable current data and a positive frame width", () => {
    const video = new FakeVideo();
    video.readyState = 1;
    video.videoWidth = 640;
    expect(hasReadableInstructFrame(video)).toBe(false);
    video.readyState = 2;
    video.videoWidth = 0;
    expect(hasReadableInstructFrame(video)).toBe(false);
    video.videoWidth = 640;
    expect(hasReadableInstructFrame(video)).toBe(true);
  });

  it("waits for a real frame and removes its deadline and listeners on readiness", () => {
    const video = new FakeVideo();
    const onReady = vi.fn();
    const onTimeout = vi.fn();
    observeInstructPreview(video, { onReady, onTimeout });
    video.dispatchEvent(new Event("loadedmetadata"));
    vi.advanceTimersByTime(7_999);
    expect(onReady).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
    video.frame();
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    const playCalls = video.playCalls;
    video.dispatchEvent(new Event("canplay"));
    vi.advanceTimersByTime(8_001);
    expect(video.playCalls).toBe(playCalls);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("retries rejected playback on media events and accepts a later frame", async () => {
    const video = new FakeVideo();
    video.rejectPlayback = true;
    const onReady = vi.fn();
    const onTimeout = vi.fn();
    observeInstructPreview(video, { onReady, onTimeout });
    await Promise.resolve();
    expect(video.playCalls).toBe(1);
    for (const event of ["loadedmetadata", "canplay", "playing", "resize"]) {
      video.dispatchEvent(new Event(event));
      await Promise.resolve();
    }
    expect(video.playCalls).toBe(5);
    expect(onTimeout).not.toHaveBeenCalled();
    video.frame();
    await Promise.resolve();
    expect(onReady).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(8_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("expires eight seconds after observation and ignores subsequent frames", () => {
    const video = new FakeVideo();
    const onReady = vi.fn();
    const onTimeout = vi.fn();
    observeInstructPreview(video, { onReady, onTimeout });
    vi.advanceTimersByTime(7_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    const playCalls = video.playCalls;
    video.frame();
    vi.advanceTimersByTime(8_000);
    expect(video.playCalls).toBe(playCalls);
    expect(onReady).not.toHaveBeenCalled();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("disposes an unfinished preview without later callbacks or playback retries", () => {
    const video = new FakeVideo();
    const onReady = vi.fn();
    const onTimeout = vi.fn();
    const dispose = observeInstructPreview(video, { onReady, onTimeout });
    dispose();
    dispose();
    expect(vi.getTimerCount()).toBe(0);
    video.frame();
    vi.advanceTimersByTime(8_000);
    expect(video.playCalls).toBe(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("never leaves a deadline after an already-ready frame is immediately captured and disposed", () => {
    const video = new FakeVideo();
    video.frame();
    const onReady = vi.fn();
    const onTimeout = vi.fn();
    const dispose = observeInstructPreview(video, { onReady, onTimeout });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    // Capture stops the stream and disposes the observer immediately.
    dispose();
    video.readyState = 0;
    video.videoWidth = 0;
    vi.advanceTimersByTime(8_001);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("gives a retried preview its own full deadline", () => {
    const video = new FakeVideo();
    const onReady = vi.fn();
    const onTimeout = vi.fn();
    const dispose = observeInstructPreview(video, { onReady, onTimeout });
    vi.advanceTimersByTime(7_000);
    dispose();
    observeInstructPreview(video, { onReady, onTimeout });
    vi.advanceTimersByTime(7_999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});
