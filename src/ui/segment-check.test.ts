import { afterEach, describe, expect, it, vi } from "vitest";
import { runSegmentCheck, SegmentCheckScope } from "./segment-check";
const result = { mode: "live", modelId: "sam", latencyMs: 20, ok: true, timedOut: false, inputKind: "image", masks: [{ objectId: "bowl", noun: "bowl", present: true, box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } }], toolCall: { modelId: "sam", purpose: "segmentation", latencyMs: 20 } };
afterEach(() => vi.useRealTimers());

describe("bounded segment checks", () => {
  it("aborts a stalled request at the total deadline and settles once", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    let resolve: (value: Response) => void = () => {};
    const pending = runSegmentCheck((signal) => { requestSignal = signal; return new Promise<Response>((done) => { resolve = done; }); }, { timeoutMs: 8000 });
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(8000);
    await rejected;
    expect(requestSignal?.aborted).toBe(true);
    resolve(Response.json(result));
    await vi.runAllTimersAsync();
  });

  it("bounds a stalled response body under the same deadline", async () => {
    vi.useFakeTimers();
    const pending = runSegmentCheck(async () => ({ ok: true, json: () => new Promise(() => {}) }) as Response, { timeoutMs: 100 });
    const rejected = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
  });

  it("rejects malformed, HTTP failures and invalid masks rather than using old evidence", async () => {
    await expect(runSegmentCheck(async () => new Response("<html>", { status: 429 }), { timeoutMs: 100 })).rejects.toThrow(/429/);
    await expect(runSegmentCheck(async () => new Response("{"), { timeoutMs: 100 })).rejects.toThrow();
    await expect(runSegmentCheck(async () => Response.json({ ...result, masks: null }), { timeoutMs: 100 })).rejects.toThrow(/invalid/i);
    const valid = await runSegmentCheck(async () => Response.json(result), { timeoutMs: 100 });
    expect(valid.masks[0].box).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 });
  });

  it("invalidates an old timeout or result when a new step starts", async () => {
    const scope = new SegmentCheckScope();
    const first = scope.begin();
    const next = scope.begin();
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    first.finish();
    expect(next.isCurrent()).toBe(true);
    scope.cancel();
    expect(next.signal.aborted).toBe(true);
    expect(next.isCurrent()).toBe(false);
  });
});
