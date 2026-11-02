import { afterEach, describe, expect, it, vi } from "vitest";
import { readLimitedBody } from "./request-body";

afterEach(() => vi.useRealTimers());
describe("bounded request bodies", () => {
  it("measures actual UTF-8 bytes and cancels a lying or absent length stream", async () => {
    const cancel = vi.fn();
    let chunk = 0;
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(new TextEncoder().encode("éé")); chunk++; }, cancel });
    const request = new Request("http://local", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readLimitedBody(request, 6)).toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunk).toBeLessThanOrEqual(3);
  });
  it("rejects declared oversized bodies before reading", async () => {
    const request = new Request("http://local", { method: "POST", headers: { "content-length": "100" }, body: "{}" });
    expect(await readLimitedBody(request, 10)).toBeNull();
    expect(request.bodyUsed).toBe(false);
  });
  it("round-trips bounded multibyte bodies", async () => {
    expect(await readLimitedBody(new Request("http://local", { method: "POST", body: "हाय" }), 32)).toBe("हाय");
  });
  it("settles a stalled stream at the body deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const request = new Request("http://local", { method: "POST", body: new ReadableStream({ cancel }), duplex: "half" } as RequestInit);
    const pending = expect(readLimitedBody(request, 100)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(30_000);
    await pending;
    expect(cancel).toHaveBeenCalledOnce();
  });
});
