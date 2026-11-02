import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareClip, validateClipSelection } from "./clip-preparation";

const mp4 = new Uint8Array([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0]);
const file = () => new File([mp4], "lesson.mp4", { type: "video/mp4" });
const decoded = async () => ({ durationSec: 30, width: 640, height: 480 });
const hash = async () => "clip-hash";

afterEach(() => vi.useRealTimers());

describe("clip preparation", () => {
  it("rejects oversized and unsupported files before reading any bytes", async () => {
    let reads = 0;
    const oversized = { name: "large.mp4", type: "video/mp4", size: 16 * 1024 * 1024 + 1, arrayBuffer: () => { reads++; return Promise.resolve(new ArrayBuffer(0)); } } as File;
    await expect(prepareClip(oversized)).rejects.toThrow(/16 MB/);
    expect(reads).toBe(0);
    expect(validateClipSelection(new File(["text"], "notes.txt", { type: "text/plain" }))).toMatch(/MP4 or WebM/);
    expect(validateClipSelection(new File([], "empty.mp4", { type: "video/mp4" }))).toMatch(/empty/);
  });

  it("rejects a renamed corrupt file even if metadata inspection succeeds", async () => {
    await expect(prepareClip(new File(["not a video"], "fake.mp4", { type: "video/mp4" }), { inspect: decoded, hash })).rejects.toThrow(/valid MP4 or WebM/);
  });

  it("requires a decodable frame and finite duration within two minutes", async () => {
    await expect(prepareClip(file(), { inspect: async () => ({ durationSec: 121, width: 640, height: 480 }), hash })).rejects.toThrow(/2 minutes/);
    await expect(prepareClip(file(), { inspect: async () => ({ durationSec: Infinity, width: 640, height: 480 }), hash })).rejects.toThrow(/decode/);
    await expect(prepareClip(file(), { inspect: async () => ({ durationSec: 30, width: 0, height: 0 }), hash })).rejects.toThrow(/decode/);
    await expect(prepareClip(file(), { inspect: async () => { throw new Error("Cannot decode this clip."); }, hash })).rejects.toThrow(/decode/);
  });

  it("returns complete media with detected MIME and duration for a supported file", async () => {
    await expect(prepareClip(file(), { inspect: decoded, hash })).resolves.toMatchObject({ durationSec: 30, mimeType: "video/mp4", clipHash: "clip-hash", videoBase64: "AAAAEGZ0eXBpc29tAAAAAA==" });
  });

  it("settles a stalled decoder and cancels without waiting for late work", async () => {
    vi.useFakeTimers();
    const stalled = prepareClip(file(), { inspect: () => new Promise(() => undefined), hash, timeoutMs: 50 });
    const failure = expect(stalled).rejects.toThrow(/too long/);
    await vi.advanceTimersByTimeAsync(50);
    await failure;
    const controller = new AbortController();
    const cancelled = prepareClip(file(), { inspect: () => new Promise(() => undefined), hash, signal: controller.signal });
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
  });
});
