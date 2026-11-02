import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveSegmentationClient, createLiveSparkClient } from "./live";
import type { SegmentRequest } from "./types";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]).toString("base64");
const prompts = ["bowl", "spoon", "cup", "plate"].map((noun) => ({ objectId: noun, noun, samPrompt: `small white ${noun}` }));
const segmentInput: SegmentRequest = { inputKind: "image", mediaBase64: jpeg, mimeType: "image/jpeg", prompts, timeoutMs: 100 };
function completed(text = "") {
  return new Response(JSON.stringify({ status: "completed", output_text: text }), { status: 200 });
}

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("live model media contracts", () => {
  it("passes all bytes of a short tutorial, including the later action, to Spark", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "reel2real-coverage-test-"));
    try {
      const clip = path.join(dir, "actions.mp4");
      const made = spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=duration=4:size=32x32:rate=2", "-c:v", "libx264", clip]);
      expect(made.status).toBe(0);
      const bytes = await readFile(clip);
      let received = Buffer.alloc(0);
      vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        const url = body.input[0].content.find((part: { type: string }) => part.type === "input_video").video_url;
        received = Buffer.from(url.split(",")[1], "base64");
        return new Response("{}", { status: 200 });
      }));
      await createLiveSparkClient("placeholder").generateSteps({ videoBase64: bytes.toString("base64"), mimeType: "video/mp4", durationSec: 4, creatorName: "Fixture creator", licenceChoice: "self_filmed" });
      expect(received.equals(bytes)).toBe(true);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("uses the precise SAM prompt for every noun", async () => {
    const sent: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)).input[0].content[0].text);
      return completed();
    }));
    const result = await createLiveSegmentationClient("placeholder").segment(segmentInput);
    expect(result.ok).toBe(true);
    expect(sent).toEqual(["small white bowl", "small white spoon", "small white cup", "small white plate"]);
  });

  it.each([2, 3, 4])("bounds %i sequential nouns by one total deadline and starts no call after it", async (count) => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      calls += 1;
      const timer = setTimeout(() => resolve(completed()), 60);
      init.signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
    })));
    const pending = createLiveSegmentationClient("placeholder").segment({ ...segmentInput, prompts: prompts.slice(0, count) });
    await vi.advanceTimersByTimeAsync(101);
    const stoppedAtDeadline = calls;
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(stoppedAtDeadline).toBe(2);
    expect(calls).toBe(2);
  });

  it("rejects JPEG bytes labeled as video before calling upstream", async () => {
    const fetcher = vi.fn(async () => completed());
    vi.stubGlobal("fetch", fetcher);
    const result = await createLiveSegmentationClient("placeholder").segment({ ...segmentInput, inputKind: "video_chunk", mimeType: "video/mp4" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/media|MIME|container/i);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects MIME and input kind disagreement before calling upstream", async () => {
    const fetcher = vi.fn(async () => completed());
    vi.stubGlobal("fetch", fetcher);
    const result = await createLiveSegmentationClient("placeholder").segment({ ...segmentInput, inputKind: "video_chunk" });
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not turn an incomplete or provider-error SAM stream into object absence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('data: {"type":"response.failed","response":{"status":"failed","error":{"message":"provider failure"}}}\n\n', { status: 200 })));
    const result = await createLiveSegmentationClient("placeholder").segment({ ...segmentInput, prompts: prompts.slice(0, 2) });
    expect(result.ok).toBe(false);
    expect(result.masks).toEqual([]);
  });

  it("rejects an invalid later prompt before spending any model calls", async () => {
    const fetcher = vi.fn(async () => completed());
    vi.stubGlobal("fetch", fetcher);
    const result = await createLiveSegmentationClient("placeholder").segment({ ...segmentInput, prompts: [prompts[0], { objectId: "bad", noun: "", samPrompt: " " }] });
    expect(result.ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not expose SAM boxes outside the image bounds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => completed("<0f>0<|box;x1=1;y1=2;x2=100;y2=200;w=10;h=10|><|mask;x=0;y=0;data=1,1,!!!!!&O.lVP|>")));
    const result = await createLiveSegmentationClient("placeholder").segment({ ...segmentInput, prompts: prompts.slice(0, 1) });
    expect(result.ok).toBe(true);
    expect(result.masks[0].present).toBe(true);
    expect(result.masks[0].box).toBeUndefined();
  });

  it("aborts the active request and starts no later nouns when the caller cancels", async () => {
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init: RequestInit) => {
      calls += 1;
      signal = init.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }));
    const pending = createLiveSegmentationClient("placeholder").segment({ ...segmentInput, signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(signal?.aborted).toBe(true);
    expect(calls).toBe(1);
  });

  it("preserves complete WebM bytes and MIME when inline rejection falls back to Files API", async () => {
    const bytes = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from("beginning; middle action; ending action")]);
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      bodies.push(init.body);
      if (url.endsWith("/files")) return new Response('{"id":"file_fixture"}', { status: 200 });
      return bodies.length === 1 ? new Response("{}", { status: 413 }) : new Response("{}", { status: 200 });
    }));
    await createLiveSparkClient("placeholder").generateSteps({ videoBase64: bytes.toString("base64"), mimeType: "video/webm", durationSec: 4, creatorName: "Fixture creator", licenceChoice: "self_filmed" });
    const inline = JSON.parse(String(bodies[0]));
    expect(inline.input[0].content[1].video_url).toBe(`data:video/webm;base64,${bytes.toString("base64")}`);
    const uploaded = (bodies[1] as FormData).get("file") as File;
    expect(uploaded.type).toBe("video/webm");
    expect(Buffer.from(await uploaded.arrayBuffer()).equals(bytes)).toBe(true);
    expect(JSON.parse(String(bodies[2])).input[0].content[1]).toEqual({ type: "input_file", file_id: "file_fixture" });
  });

  it("bounds a stalled Files API upload and never starts generation afterward", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      calls += 1;
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const bytes = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    const pending = createLiveSparkClient("placeholder").generateSteps({ videoBase64: bytes.toString("base64"), mimeType: "video/mp4", durationSec: 11, creatorName: "Fixture creator", licenceChoice: "self_filmed" });
    let result: Awaited<typeof pending> | undefined;
    void pending.then((value) => { result = value; });
    await vi.advanceTimersByTimeAsync(45_001);
    expect(result?.schemaValid).toBe(false);
    expect(result?.errors.join(" ")).toMatch(/timed out|deadline/i);
    expect(calls).toBe(1);
  });
});
