import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveSparkClient } from "./live";
import { sampleById } from "./fixtures";
import type { SparkRequest } from "./types";

const input: SparkRequest = {
  videoBase64: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3]).toString("base64"),
  mimeType: "video/webm", durationSec: 6, creatorName: "Upload creator",
  licenceChoice: "permission_granted", creditLink: "https://example.com/credit",
};
function draft(): Record<string, any> {
  const value: Record<string, any> = sampleById("aloo-jeera");
  delete value.tutorialId;
  value.steps = value.steps.slice(0, 2);
  value.steps[0].sourceTimeRange = { startSec: 0.25, endSec: 1.5 };
  value.steps[1].sourceTimeRange = { startSec: 3.75, endSec: 5.8 };
  return value;
}
function respond(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { status: 200 })));
}
beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("live upload draft contract", () => {
  it("supplies missing identity and actual execution metadata while preserving later video semantics", async () => {
    const payload = draft();
    payload.generation = { mode: "invented", modelId: "invented", toolCalls: [{ tool: "invented" }] };
    respond(payload);
    const client = createLiveSparkClient("unit-test-upload-key");
    const result = await client.generateSteps(input);
    expect(result.errors).toEqual([]);
    expect(result.schemaValid).toBe(true);
    const tutorial = result.tutorial!;
    expect(tutorial.tutorialId).toBeTruthy();
    expect((await client.generateSteps(input)).tutorial?.tutorialId).not.toBe(tutorial.tutorialId);
    expect(tutorial.steps.map(({ credit, ...step }) => step)).toEqual(payload.steps.map(({ credit, ...step }: any) => step));
    expect(tutorial.steps[1].objects.at(-1)?.role).toBe("required_absent");
    expect(tutorial.sourceClip).toMatchObject({ mediaType: "video/webm", durationSec: 6, stillPlaceholder: false });
    expect(tutorial.generation).toEqual({ mode: "muse_spark_live", modelId: "muse-spark-1.3", toolCalls: result.toolCalls });
    expect(result.toolCalls).toEqual([{ tool: "muse_spark", modelId: "muse-spark-1.3", purpose: "tutorial_clip_to_steps_json", inputKind: "clip", latencyMs: result.latencyMs }]);
    expect(tutorial.attribution).toEqual({ creatorName: "Upload creator", creditLine: "Upload creator · permission granted · https://example.com/credit", licence: "written_permission" });
    expect(tutorial.steps.every((step) => step.credit.creatorName === "Upload creator")).toBe(true);
  });

  it.each([
    ["unknown role", (p: any) => { p.steps[1].objects[0].role = "present"; }],
    ["unknown success kind", (p: any) => { p.steps[1].successCheck.kind = "present"; }],
    ["unsupported version", (p: any) => { p.schemaVersion = "2.0.0"; }],
    ["broken reference", (p: any) => { p.steps[1].successCheck.requiredObjectIds = ["missing"]; }],
    ["range beyond actual duration", (p: any) => { p.steps[1].sourceTimeRange.endSec = 7; }],
    ["empty ID", (p: any) => { p.tutorialId = ""; }],
    ["null ID", (p: any) => { p.tutorialId = null; }],
    ["numeric ID", (p: any) => { p.tutorialId = 3; }],
    ["missing step instruction", (p: any) => { delete p.steps[1].instructionText; }],
    ["missing steps", (p: any) => { delete p.steps; }],
    ["missing schema version", (p: any) => { delete p.schemaVersion; }],
    ["malformed schema version", (p: any) => { p.schemaVersion = 1; }],
  ])("rejects %s", async (_name, mutate) => {
    const payload = draft();
    payload.tutorialId = "valid_model_id";
    mutate(payload);
    respond(payload);
    const result = await createLiveSparkClient("unit-test-upload-key").generateSteps(input);
    expect(result.schemaValid).toBe(false);
    expect(result.tutorial).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("preserves valid model identity", async () => {
    const payload = draft();
    payload.tutorialId = "model_tutorial_identity";
    respond(payload);
    const result = await createLiveSparkClient("unit-test-upload-key").generateSteps(input);
    expect(result.tutorial?.tutorialId).toBe("model_tutorial_identity");
  });

  it("supplies transcript identity and actual execution provenance", async () => {
    const payload = draft();
    delete payload.generation;
    respond(payload);
    const result = await createLiveSparkClient("unit-test-upload-key").generateSteps({ ...input, videoBase64: undefined, transcript: "Prepare and chop the onion." });
    expect(result.errors).toEqual([]);
    expect(result.tutorial?.generation).toMatchObject({ mode: "muse_spark_live", modelId: "muse-spark-1.3", toolCalls: result.toolCalls });
    expect(result.toolCalls[0].inputKind).toBe("transcript");
    expect(result.tutorial?.sourceClip).toEqual(payload.sourceClip);
  });

  it.each([false, true])("preserves curated sample identity and provenance with attribution=%s", async (attributed) => {
    const curated = sampleById("aloo-jeera");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const result = await createLiveSparkClient("unit-test-upload-key").generateSteps({ sampleId: "aloo-jeera", ...(attributed ? { creatorName: input.creatorName, licenceChoice: input.licenceChoice } : {}) });
    expect(result.tutorial?.tutorialId).toBe(curated.tutorialId);
    expect(result.tutorial?.generation).toEqual(curated.generation);
    expect(result.tutorial?.sourceClip).toEqual(curated.sourceClip);
    expect(result.toolCalls).toEqual(curated.generation.toolCalls);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
