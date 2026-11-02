import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import tutorial from "@/src/fixtures/sample-aloo-jeera.steps.json";
import type { SparkResult } from "@/src/server/types";
import type { PrepareRequest } from "./session";
import { postSpark } from "./sparkOnce";

class FakeXHR {
  static requests: FakeXHR[] = [];
  status = 0;
  responseText = "";
  timeout = 0;
  body = "";
  aborted = false;
  upload = { onprogress: null as null | (() => void), onload: null as null | (() => void) };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  ontimeout: null | (() => void) = null;
  onabort: null | (() => void) = null;
  constructor() { FakeXHR.requests.push(this); }
  open() {}
  setRequestHeader() {}
  send(body: string) { this.body = body; }
  abort() { this.aborted = true; this.onabort?.(); }
  respond(body: unknown = success(), status = 200) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    this.onload?.();
  }
}

function success(): SparkResult {
  return {
    mode: "mock", modelId: "muse-spark-1.3", latencyMs: 2,
    schemaValid: true, parseOk: true, errors: [],
    tutorial: structuredClone(tutorial) as SparkResult["tutorial"],
    toolCalls: [], inputKind: "sample",
  };
}

let testIdentity = 0;
const prepare = (extra: Partial<PrepareRequest> = {}): PrepareRequest => ({ key: `request-${testIdentity}`, sampleId: `sample-${testIdentity}`, hasClip: false, ...extra });
const latest = () => FakeXHR.requests[FakeXHR.requests.length - 1];

describe("Spark extraction transport", () => {
  beforeEach(() => {
    testIdentity += 1;
    vi.useFakeTimers();
    FakeXHR.requests = [];
    vi.stubGlobal("XMLHttpRequest", FakeXHR);
  });
  afterEach(async () => {
    for (const xhr of FakeXHR.requests) xhr.onabort?.();
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("releases successful requests so a later run sends current input", async () => {
    const first = postSpark(prepare());
    latest().respond();
    expect((await first).tutorial?.title).toBe(tutorial.title);
    const later = postSpark(prepare());
    expect(FakeXHR.requests).toHaveLength(2);
    latest().respond();
    await later;
  });

  it("shares only concurrent identical payloads regardless of local request key", async () => {
    const first = postSpark(prepare());
    const second = postSpark(prepare({ key: "new-local-key" }));
    expect(FakeXHR.requests).toHaveLength(1);
    latest().respond();
    expect(await second).toEqual(await first);
  });

  it.each([
    { title: "Edited title" }, { transcript: "different steps" }, { creatorName: "New creator" },
    { domain: "non_cooking_diy" as const }, { creditLink: "https://example.com/credit" },
    { licenceChoice: "permission_granted" as const },
  ])("does not reuse a same-key request with changed metadata %j", async (metadata) => {
    const first = postSpark(prepare());
    const second = postSpark(prepare(metadata));
    expect(FakeXHR.requests).toHaveLength(2);
    FakeXHR.requests.forEach((xhr) => xhr.respond());
    await Promise.all([first, second]);
  });

  it.each(["{bad", "", "null", "{}", JSON.stringify({ ...success(), tutorial: { title: "invalid" } })])(
    "rejects malformed or invalid successful JSON %s without escaping the event", async (body) => {
      const result = postSpark(prepare()).catch((error: Error) => error);
      expect(() => latest().respond(body)).not.toThrow();
      expect(await result).toBeInstanceOf(Error);
      const retry = postSpark(prepare());
      expect(FakeXHR.requests).toHaveLength(2);
      latest().respond();
      await retry;
    },
  );

  it.each([
    { mode: ["live"] },
    { inputKind: ["sample"] },
    { toolCalls: [{ tool: ["tts"], modelId: "muse-spark-1.3", purpose: "voice" }] },
  ])("rejects non-string envelope enums instead of coercing them %j", async (fields) => {
    const result = postSpark(prepare()).catch((error: Error) => error);
    latest().respond({ ...success(), ...fields });
    expect(await result).toBeInstanceOf(Error);
  });

  it("rejects an empty 204 body", async () => {
    const result = postSpark(prepare()).catch((error: Error) => error);
    expect(() => latest().respond("", 204)).not.toThrow();
    expect(await result).toBeInstanceOf(Error);
  });

  it("preserves safe HTTP failure information including daily cap", async () => {
    const first = postSpark(prepare()).catch((error: Error) => error);
    latest().respond({ error: "daily_cap", message: "Daily call limit reached." }, 429);
    expect(await first).toMatchObject({ status: 429, code: "daily_cap", message: "Daily call limit reached." });
    const second = postSpark(prepare()).catch((error: Error) => error);
    latest().respond("<h1>Unauthorized</h1>", 401);
    expect(await second).toMatchObject({ status: 401, message: "Spark failed (HTTP 401)." });
  });

  it.each(["onerror", "ontimeout", "onabort"] as const)("settles %s and frees the request", async (event) => {
    let outcome: unknown;
    const result = postSpark(prepare()).catch((error: Error) => { outcome = error; });
    latest()[event]?.();
    await Promise.resolve();
    expect(outcome).toBeInstanceOf(Error);
    await result;
    const retry = postSpark(prepare());
    expect(FakeXHR.requests).toHaveLength(2);
    latest().respond();
    await retry;
  });

  it("bounds a stalled transport even when native timeout events never arrive", async () => {
    let outcome: unknown;
    const result = postSpark(prepare(), undefined, { timeoutMs: 25 }).catch((error: Error) => { outcome = error; });
    await vi.advanceTimersByTimeAsync(26);
    expect(outcome).toMatchObject({ name: "TimeoutError" });
    expect(latest().aborted).toBe(true);
    await result;
  });

  it("cancels only the aborted subscriber of a shared request", async () => {
    const controller = new AbortController();
    const first = postSpark(prepare(), undefined, { signal: controller.signal }).catch((error: Error) => error);
    const stages: string[] = [];
    const second = postSpark(prepare(), (stage) => stages.push(stage));
    controller.abort();
    await Promise.resolve();
    latest().upload.onload?.();
    expect(latest().aborted).toBe(false);
    latest().respond();
    expect(await first).toMatchObject({ name: "AbortError" });
    expect((await second).schemaValid).toBe(true);
    expect(stages).toContain("reading");
  });

  it("allows Strict Mode cleanup and resubscribe to reuse the active transport", async () => {
    const controller = new AbortController();
    const first = postSpark(prepare(), undefined, { signal: controller.signal }).catch((error: Error) => error);
    controller.abort();
    const second = postSpark(prepare());
    await Promise.resolve();
    expect(FakeXHR.requests).toHaveLength(1);
    expect(latest().aborted).toBe(false);
    latest().respond();
    expect(await first).toMatchObject({ name: "AbortError" });
    await second;
  });

  it("aborts the transport after its last subscriber leaves", async () => {
    const controller = new AbortController();
    const result = postSpark(prepare(), undefined, { signal: controller.signal }).catch((error: Error) => error);
    controller.abort();
    await Promise.resolve();
    expect(await result).toMatchObject({ name: "AbortError" });
    expect(latest().aborted).toBe(true);
  });

  it("does not send an already cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await postSpark(prepare(), undefined, { signal: controller.signal }).catch((error: Error) => error);
    expect(result).toMatchObject({ name: "AbortError" });
    expect(FakeXHR.requests).toHaveLength(0);
  });

  it("rejects through its promise when constructing the transport fails", async () => {
    vi.stubGlobal("XMLHttpRequest", class {
      constructor() { throw new Error("Transport unavailable"); }
    });
    let request: Promise<SparkResult> | undefined;
    expect(() => { request = postSpark(prepare()); }).not.toThrow();
    await expect(request).rejects.toThrow("Transport unavailable");
  });

  it("does not send when initial progress rendering cancels the request", async () => {
    const controller = new AbortController();
    const request = postSpark(prepare(), () => controller.abort(), { signal: controller.signal }).catch((error: Error) => error);
    expect(await request).toMatchObject({ name: "AbortError" });
    expect(latest().body).toBe("");
    const retry = postSpark(prepare());
    latest().respond();
    expect((await retry).schemaValid).toBe(true);
  });

  it("settles once if an XHR delivers conflicting terminal events", async () => {
    const first = postSpark(prepare());
    const xhr = latest();
    xhr.respond();
    xhr.onerror?.();
    xhr.onabort?.();
    expect((await first).schemaValid).toBe(true);
    const retry = postSpark(prepare());
    expect(FakeXHR.requests).toHaveLength(2);
    latest().respond();
    await retry;
  });
});
