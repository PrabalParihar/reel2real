import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionProvider, useSession } from "./session";
import { loadRuntime } from "./runtime-preflight";

const supported = {
  mock: false, sparkModelId: "muse-spark-1.3", samModelId: "sam-3.1",
  capabilities: { spark: true, instruct: true, segment: false },
};

describe("runtime preflight", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("keeps camera and clip capabilities disabled before preflight resolves", () => {
    let runtime: ReturnType<typeof useSession>["runtime"] | undefined;
    function Probe() { runtime = useSession().runtime; return null; }
    renderToStaticMarkup(createElement(SessionProvider, { children: createElement(Probe) }));
    expect(runtime?.capabilities).toEqual({ spark: false, instruct: false, segment: false });
  });

  it("enables only explicitly validated configured capabilities", async () => {
    vi.stubGlobal("fetch", async () => Response.json(supported));
    expect(await loadRuntime()).toEqual(supported);
  });

  it("keeps optional legacy capabilities disabled instead of guessing from mock", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ mock: false, sparkModelId: "spark", samModelId: "sam" }));
    expect((await loadRuntime()).capabilities).toEqual({ spark: false, instruct: false, segment: false });
  });

  it.each([null, [], {}, { ...supported, mock: "false" }, { ...supported, sparkModelId: "" },
    { ...supported, capabilities: { spark: true } }, { ...supported, capabilities: { spark: "true", instruct: true, segment: false } },
  ])("rejects malformed runtime data %j", async (data) => {
    vi.stubGlobal("fetch", async () => Response.json(data));
    await expect(loadRuntime()).rejects.toBeInstanceOf(Error);
  });

  it("rejects a failed status even with a valid-looking enabled body", async () => {
    vi.stubGlobal("fetch", async () => Response.json(supported, { status: 500 }));
    await expect(loadRuntime()).rejects.toBeInstanceOf(Error);
  });

  it("bounds a stalled runtime fetch at five seconds and aborts it", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_url: string, options: RequestInit) => { signal = options.signal as AbortSignal; return new Promise(() => {}); });
    let outcome: unknown;
    const pending = loadRuntime().catch((error: unknown) => { outcome = error; });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(outcome).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toMatchObject({ name: "TimeoutError" });
    expect(signal?.aborted).toBe(true);
    await pending;
  });

  it("keeps the same bound while reading a stalled JSON body", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => ({ ok: true, json: () => new Promise(() => {}) }));
    let outcome: unknown;
    const pending = loadRuntime().catch((error: unknown) => { outcome = error; });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(outcome).toMatchObject({ name: "TimeoutError" });
    await pending;
  });

  it("cancels a pending body read when the session leaves", async () => {
    const controller = new AbortController();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return { ok: true, json: () => new Promise(() => {}) };
    });
    const pending = loadRuntime(controller.signal).catch((error: Error) => error);
    controller.abort();
    expect(await pending).toMatchObject({ name: "AbortError" });
    expect(signal?.aborted).toBe(true);
  });

  it("never starts a runtime fetch after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(loadRuntime(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
