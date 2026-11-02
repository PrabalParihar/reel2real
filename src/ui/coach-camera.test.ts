import { afterEach, describe, expect, it, vi } from "vitest";
import { readyCoachCamera } from "./coach-camera";
afterEach(() => vi.useRealTimers());
function video(play: () => Promise<void>, width = 640) {
  const target = new EventTarget();
  return Object.assign(target, { play, videoWidth: width, videoHeight: width ? 480 : 0, readyState: width ? 2 : 0, srcObject: null }) as unknown as HTMLVideoElement;
}
describe("usable coach camera", () => {
  it("rejects blocked playback instead of reporting live", async () => {
    await expect(readyCoachCamera(video(async () => { throw new Error("playback blocked"); }), {} as MediaStream, { timeoutMs: 100 })).rejects.toThrow("playback blocked");
  });
  it("bounds missing frames even if play resolves", async () => {
    vi.useFakeTimers();
    const check = readyCoachCamera(video(async () => {}, 0), {} as MediaStream, { timeoutMs: 100 }).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(100);
    expect(await check).toMatchObject({ name: "TimeoutError" });
  });
  it("attaches the acquired camera and waits for usable frame dimensions", async () => {
    const element = video(async () => {});
    const stream = {} as MediaStream;
    await readyCoachCamera(element, stream, { timeoutMs: 100 });
    expect(element.srcObject).toBe(stream);
  });
});
