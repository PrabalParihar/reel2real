import { afterEach, describe, expect, it, vi } from "vitest";
import { publicRuntime } from "./env";
import { modelExecutionMode } from "./model-execution";
import { POST as sparkPost } from "../../app/api/spark/route";
import { POST as segmentPost } from "../../app/api/segment/route";
import { POST as internalSegment } from "../../app/api/internal/segment/route";
import * as factory from "./factory";
import { handleInstructRequest } from "./instruct";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("explicit public model execution", () => {
  it("keeps key-only and opt-in-only configurations off", () => {
    expect(modelExecutionMode({ META_MODEL_API_KEY: "test-key" }, "spark")).toBe("off");
    expect(modelExecutionMode({ META_DIRECT_ENABLED: "1" }, "segment")).toBe("off");
    expect(modelExecutionMode({ META_DIRECT_ENABLED: "true", META_MODEL_API_KEY: "test-key" }, "spark")).toBe("off");
    expect(publicRuntime({ META_MODEL_API_KEY: "test-key" })).toMatchObject({ mock: true, capabilities: { spark: false, instruct: false, segment: false } });
  });

  it("reports configured direct routes only with an explicit opt-in and key", () => {
    const env = { META_DIRECT_ENABLED: "1", META_MODEL_API_KEY: "test-key" };
    expect(modelExecutionMode(env, "spark")).toBe("direct");
    expect(modelExecutionMode(env, "segment")).toBe("direct");
    expect(publicRuntime(env)).toMatchObject({ mock: false, capabilities: { spark: true, instruct: true, segment: true }, execution: { spark: "direct", instruct: "direct", segment: "direct" } });
  });

  it("prefers a configured worker and does not advertise a secretless SAM worker", () => {
    const base = { META_DIRECT_ENABLED: "1", META_MODEL_API_KEY: "test-key", MUSE_FORWARD_ENABLED: "1", SAM_FORWARD_ENABLED: "1", SAM_FORWARD_URL: "https://worker.example/api/internal/segment", SAM_FORWARD_SECRET: "test-secret" };
    expect(modelExecutionMode(base, "spark")).toBe("forward");
    expect(modelExecutionMode(base, "segment")).toBe("forward");
    expect(modelExecutionMode({ SAM_FORWARD_ENABLED: "1", SAM_FORWARD_URL: base.SAM_FORWARD_URL }, "segment")).toBe("off");
  });

  it("executes the direct opt-in through the model client without needing a forward worker", async () => {
    vi.stubEnv("META_DIRECT_ENABLED", "1"); vi.stubEnv("META_MODEL_API_KEY", "test-key");
    vi.stubEnv("MUSE_FORWARD_ENABLED", "0"); vi.stubEnv("SAM_FORWARD_ENABLED", "0");
    const generateSteps = vi.fn(async () => ({ mode: "live", schemaValid: false, parseOk: true, tutorial: null, errors: [], toolCalls: [], inputKind: "transcript" }));
    const segment = vi.fn(async () => ({ mode: "live", ok: true, masks: [], toolCall: {}, inputKind: "image" }));
    vi.spyOn(factory, "createModelClients").mockReturnValue({ mode: "live", spark: { generateSteps }, segmentation: { segment } } as never);
    const make = (path: string, body: unknown) => new Request(`http://local${path}`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": "192.0.2.179" }, body: JSON.stringify(body) });
    expect((await sparkPost(make("/api/spark", { transcript: "Fold paper", creatorName: "QA", licenceChoice: "self_filmed" }))).status).toBe(200);
    expect(generateSteps).toHaveBeenCalledOnce();
    expect((await segmentPost(make("/api/segment", { inputKind: "image", prompts: [], timeoutMs: 1000 }))).status).toBe(200);
    expect(segment).toHaveBeenCalledOnce();
  });

  it("allows explicit direct Instruction calls and passes a bounded cancellation signal", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify({ output_text: JSON.stringify({ title: "Fold paper", steps: [{ instructionText: "Place the paper and cup in view", objects: [{ noun: "paper", samPrompt: "paper" }, { noun: "cup", samPrompt: "cup" }] }] }) }), { status: 200 });
    });
    const response = await handleInstructRequest(new Request("http://local/api/instruct", { method: "POST", body: JSON.stringify({ goal: "Fold paper", imageDataUrl: `data:image/jpeg;base64,${Buffer.alloc(64, 7).toString("base64")}`, mimeType: "image/jpeg" }) }), { env: { META_DIRECT_ENABLED: "1", META_MODEL_API_KEY: "test-key" }, fetchImpl, skipGuard: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: "live", schemaValid: true });
  });
});

describe("route payload failures", () => {
  it.each([null, [], { transcript: 7 }, { durationSec: -2 }, { title: {} }])("rejects invalid Spark values without model calls: %j", async (body) => {
    const clients = vi.spyOn(factory, "createModelClients");
    const response = await sparkPost(new Request("http://local/api/spark", { method: "POST", body: JSON.stringify(body), headers: { "x-real-ip": "192.0.2.181" } }));
    expect(response.status).toBe(400);
    expect(clients).not.toHaveBeenCalled();
  });

  it("returns a stable bad-JSON response from the authenticated segment worker", async () => {
    vi.stubEnv("SAM_FORWARD_SECRET", "test-secret");
    const response = await internalSegment(new Request("http://local/api/internal/segment", { method: "POST", body: "{", headers: { "x-r2r-forward-secret": "test-secret", "x-real-ip": "192.0.2.182" } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_json" });
  });

  it.each([{ prompts: "cup" }, { prompts: [null] }, { prompts: [], timeoutMs: -1 }])("rejects invalid segment values: %j", async (body) => {
    const response = await segmentPost(new Request("http://local/api/segment", { method: "POST", body: JSON.stringify(body), headers: { "x-real-ip": "192.0.2.183" } }));
    expect(response.status).toBe(400);
  });
});
