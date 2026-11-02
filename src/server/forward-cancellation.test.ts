import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as instructPost } from "../../app/api/instruct/route";
import { POST as segmentPost } from "../../app/api/segment/route";
import { POST as sparkPost } from "../../app/api/spark/route";
import { forwardMuseRequest } from "./muse-forward";
import { forwardSamRequest } from "./sam-forward";

const env = {
  MUSE_FORWARD_ENABLED: "1",
  SAM_FORWARD_ENABLED: "1",
  SAM_FORWARD_URL: "http://worker.internal/api/internal/segment",
  SAM_FORWARD_SECRET: "test-forward-secret",
};
const segmentBody = JSON.stringify({
  inputKind: "image",
  mediaBase64: "/9j/2Q==",
  mimeType: "image/jpeg",
  prompts: [{ objectId: "paper", noun: "paper", samPrompt: "paper" }],
});
const sparkBody = JSON.stringify({ transcript: "Fold the paper square.", creatorName: "Fixture", licenceChoice: "self_filmed" });
const instructBody = JSON.stringify({
  goal: "Fold paper",
  imageDataUrl: `data:image/jpeg;base64,${Buffer.alloc(64, 7).toString("base64")}`,
  mimeType: "image/jpeg",
});

beforeEach(() => {
  vi.useFakeTimers();
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  vi.stubEnv("META_DAILY_CALL_CAP", "200");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const helpers = [
  {
    name: "Muse",
    status: 502,
    forward: (signal: AbortSignal | undefined, fetchImpl: typeof fetch) => forwardMuseRequest({
      rawBody: sparkBody, env, route: "spark", signal, fetchImpl, timeoutMs: 100,
    }),
  },
  {
    name: "SAM",
    status: 200,
    forward: (signal: AbortSignal | undefined, fetchImpl: typeof fetch) => forwardSamRequest({
      rawBody: segmentBody, env, signal, fetchImpl, timeoutMs: 100,
    }),
  },
];

describe.each(helpers)("$name forwarding cancellation", ({ forward, status }) => {
  it("does not start an outbound request for an already cancelled caller", async () => {
    const caller = new AbortController();
    caller.abort();
    const fetchImpl = vi.fn(async () => Response.json({ unexpected: true }));

    const response = await forward(caller.signal, fetchImpl);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.status).toBe(status);
  });

  it("settles and aborts an active outbound request even when fetch ignores cancellation", async () => {
    const caller = new AbortController();
    let outboundSignal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      outboundSignal = init?.signal;
      return new Promise<Response>(() => undefined);
    });
    let response: Response | undefined;
    void forward(caller.signal, fetchImpl).then((value) => { response = value; });
    expect(fetchImpl).toHaveBeenCalledOnce();

    caller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(outboundSignal?.aborted).toBe(true);
    expect(response?.status).toBe(status);
  });

  it("bounds a stalled response body when the caller cancels", async () => {
    const caller = new AbortController();
    const upstream = Response.json({ unexpected: true });
    const readBody = vi.spyOn(upstream, "arrayBuffer").mockReturnValue(new Promise(() => undefined));
    let outboundSignal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      outboundSignal = init?.signal;
      return upstream;
    });
    let response: Response | undefined;
    void forward(caller.signal, fetchImpl).then((value) => { response = value; });
    await vi.advanceTimersByTimeAsync(0);
    expect(readBody).toHaveBeenCalledOnce();

    caller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(outboundSignal?.aborted).toBe(true);
    expect(response?.status).toBe(status);
  });

  it("retains one deadline across fetch and a stalled response body", async () => {
    const upstream = Response.json({ unexpected: true });
    vi.spyOn(upstream, "arrayBuffer").mockReturnValue(new Promise(() => undefined));
    let outboundSignal: AbortSignal | null | undefined;
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      outboundSignal = init?.signal;
      return new Promise<Response>((resolve) => { setTimeout(() => resolve(upstream), 60); });
    });
    let response: Response | undefined;
    void forward(undefined, fetchImpl).then((value) => { response = value; });
    await vi.advanceTimersByTimeAsync(99);
    expect(response).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);

    expect(outboundSignal?.aborted).toBe(true);
    expect(response?.status).toBe(status);
    const body = await response?.json();
    if (status === 502) expect(body.message).toBe("Spark timed out.");
    else expect(body).toMatchObject({ ok: false, timedOut: true, masks: [] });
  });
});

const routes = [
  { name: "spark", post: sparkPost, body: sparkBody, status: 502, day: "2035-01-01", ip: "192.0.2.211" },
  { name: "instruct", post: instructPost, body: instructBody, status: 502, day: "2035-01-02", ip: "192.0.2.212" },
  { name: "segment", post: segmentPost, body: segmentBody, status: 200, day: "2035-01-03", ip: "192.0.2.213" },
];

describe.each(routes)("public $name forwarding", ({ name, post, body, status, day, ip }) => {
  const request = (signal?: AbortSignal) => new Request(`http://local/api/${name}`, {
    method: "POST", body, signal,
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });

  it("passes pre-cancellation to the worker boundary and keeps the reserved budget spent", async () => {
    vi.setSystemTime(new Date(day));
    vi.stubEnv("META_DAILY_CALL_CAP", "1");
    const caller = new AbortController();
    caller.abort();
    const fetchImpl = vi.fn(async () => Response.json({ unexpected: true }));
    vi.stubGlobal("fetch", fetchImpl);

    const cancelled = await post(request(caller.signal));
    const capped = await post(request());

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cancelled.status).toBe(status);
    expect(capped.status).toBe(429);
    expect(await capped.json()).toMatchObject({ error: "daily_cap" });
  });

  it("passes active caller cancellation through to the outbound request", async () => {
    const caller = new AbortController();
    let outboundSignal: AbortSignal | null | undefined;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      outboundSignal = init?.signal;
      markStarted();
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal("fetch", fetchImpl);
    let response: Response | undefined;
    void post(request(caller.signal)).then((value) => { response = value; });
    await started;

    caller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(outboundSignal?.aborted).toBe(true);
    expect(response?.status).toBe(status);
  });
});
