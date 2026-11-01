import { describe, expect, it, vi } from "vitest";
import { tutorialFromSparkPayload } from "@/src/schema/attribution";
import { validateTutorialSteps } from "@/src/schema/validate";
import chaiFixture from "@/src/fixtures/instruct-chai.muse.json";
import origamiFixture from "@/src/fixtures/instruct-origami.muse.json";
import sampleFixture from "@/src/fixtures/sample-aloo-jeera.steps.json";
import { normalizeSparkPayload } from "@/src/schema/normalize";
import { coerceInstructDocument } from "./instruct-coerce";
import { handleInstructRequest, INSTRUCT_DEBUG_MAX } from "./instruct";

const CHAI_ERRORS = [
  "must have required property 'tutorialId'",
  ...Array.from({ length: 14 }, () => "must be equal to one of the allowed values"),
];

const ORIGAMI_ERRORS = [
  "must have required property 'tutorialId'",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be > 0",
  "must be > 0",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be > 0",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be > 0",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
  "must be equal to one of the allowed values",
];

function strictMessages(payload: unknown): string[] {
  const result = tutorialFromSparkPayload(payload, { creatorName: "You", licence: "self_filmed" }, {
    title: "goal",
    durationSec: 24,
  });
  return result.ok ? [] : result.errors.map((error) => error.message);
}

describe("instruct schema fixtures", () => {
  it("reproduces the chai error list, then accepts it after normalising", async () => {
    const coerced = coerceInstructDocument(chaiFixture, "Make a chai spice mix");
    const paths = coerced.coercions.map((item) => `${item.path}=${item.value}`);
    expect(paths).toContain("/domain=recipe");
    expect(paths).toContain("/sourceClip/mediaType=image/jpeg");
    expect(paths).toContain("/steps/0/generation/toolCalls/0/tool=spark");
    expect(paths).toContain("/steps/0/objects/0/role=present");
    expect(paths).toContain("/steps/0/successCheck/kind=highlight");
    expect((coerced.value as { generation: { toolCalls: Array<{ tool: string }> } }).generation.toolCalls[0].tool).toBe("muse_spark");
    expect(strictMessages(chaiFixture)).toEqual(CHAI_ERRORS);
    expect(CHAI_ERRORS.filter((message) => message.includes("allowed values"))).toHaveLength(14);
    const { normalizeInstructPayload } = await import("./instruct");
    const result = normalizeInstructPayload(chaiFixture, "Make a chai spice mix", "live", 0, "{\"title\":\"Make a chai spice mix\"}");
    expect(result.schemaValid).toBe(true);
    expect(result.parseOk).toBe(true);
    expect(result.tutorial?.tutorialId).toBe("instruct-make-a-chai-spice-mix");
    expect(result.tutorial?.domain).toBe("indian_recipe");
    expect(result.tutorial?.sourceClip.mediaType).toBe("video/mp4");
    expect(result.tutorial?.sourceClip.durationSec).toBe(8);
    expect(result.tutorial?.sourceClip.stillPlaceholder).toBe(true);
    expect(result.tutorial?.generation.toolCalls[0]?.tool).toBe("muse_spark");
    expect(result.tutorial?.steps[0].sourceTimeRange.endSec).toBeGreaterThan(0);
    expect(result.tutorial?.steps[0].objects[0].role).toBe("required_present");
    expect(result.tutorial?.steps[0].successCheck.kind).toBe("all_required_present");
    expect(result.debug).toBeUndefined();
  });

  it("reproduces the origami error list, then accepts it after normalising", async () => {
    const dropped = structuredClone(origamiFixture) as {
      runtimeHints: { preferredLiveMode?: string };
      generation: { toolCalls: Array<{ tool: string; inputKind?: string }> };
    };
    dropped.runtimeHints.preferredLiveMode = "made_up_mode";
    dropped.generation.toolCalls[0].tool = "not_a_tool";
    dropped.generation.toolCalls[0].inputKind = "made_up_kind";
    const coerced = coerceInstructDocument(dropped, "Fold an origami crane");
    const doc = coerced.value as {
      runtimeHints?: { preferredLiveMode?: string };
      generation: { toolCalls: Array<{ tool: string; inputKind: string }> };
      sourceClip: { mediaType: string; durationSec: number };
    };
    expect(doc.runtimeHints?.preferredLiveMode).toBeUndefined();
    expect(doc.generation.toolCalls[0].tool).toBe("muse_spark");
    expect(doc.generation.toolCalls[0].inputKind).toBe("image");
    expect(doc.sourceClip.mediaType).toBe("video/mp4");
    expect(doc.sourceClip.durationSec).toBe(8);
    const paths = coerced.coercions.map((item) => `${item.path}=${item.value}`);
    expect(paths).toContain("/runtimeHints/preferredLiveMode=made_up_mode");
    expect(paths).toContain("/generation/toolCalls/0/tool=not_a_tool");
    expect(paths).toContain("/generation/toolCalls/0/inputKind=made_up_kind");
    expect(paths).toContain("/sourceClip/durationSec=0");
    expect(strictMessages(origamiFixture)).toEqual(ORIGAMI_ERRORS);
    expect(ORIGAMI_ERRORS.filter((message) => message.includes("allowed values"))).toHaveLength(14);
    expect(ORIGAMI_ERRORS.filter((message) => message === "must be > 0")).toHaveLength(4);
    const { normalizeInstructPayload } = await import("./instruct");
    const result = normalizeInstructPayload(origamiFixture, "Fold an origami crane", "live");
    expect(result.schemaValid).toBe(true);
    expect(result.tutorial?.tutorialId).toBe("instruct-fold-an-origami-crane");
    expect(result.tutorial?.domain).toBe("non_cooking_diy");
    expect(result.tutorial?.sourceClip.durationSec).toBe(8);
    expect(result.tutorial?.sourceClip.stillPlaceholder).toBe(true);
    expect(result.tutorial?.generation.toolCalls[0]?.tool).toBe("muse_spark");
    for (const step of result.tutorial?.steps ?? []) {
      expect(step.sourceTimeRange.endSec).toBeGreaterThan(0);
    }
  });

  it("coerces an unknown role to required_present and keeps the plan", async () => {
    const payload = structuredClone(chaiFixture) as {
      steps: Array<{ objects: Array<{ role: string }> }>;
    };
    payload.steps[0].objects[0].role = "not_a_role";
    const raw = `${"x".repeat(5000)} test-only-not-a-meta-key`;
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
    const previous = process.env.META_MODEL_API_KEY;
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    try {
      const response = await handleInstructRequest(new Request("http://local/api/instruct", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.210" },
        body: JSON.stringify({
          goal: "I want to make chai",
          imageDataUrl: `data:image/jpeg;base64,${Buffer.alloc(64, 7).toString("base64")}`,
          mimeType: "image/jpeg",
        }),
      }), {
        ask: async () => ({ status: 200, payload, rawText: raw }),
      });
      expect(response.status).toBe(200);
      const body = await response.json() as {
        schemaValid?: boolean;
        debug?: string;
        tutorial?: { steps: Array<{ objects: Array<{ role: string }> }> };
      };
      expect(body.schemaValid).toBe(true);
      expect(body.debug).toBeUndefined();
      expect(body.tutorial?.steps[0].objects[0].role).toBe("required_present");
      expect(errors.some((line) => line.includes("path=/steps/0/objects/0/role") && line.includes("not_a_role"))).toBe(true);
      expect(errors.join("\n")).not.toContain("test-only-not-a-meta-key");
    } finally {
      if (previous === undefined) delete process.env.META_MODEL_API_KEY;
      else process.env.META_MODEL_API_KEY = previous;
      vi.restoreAllMocks();
    }
  });

  it("returns 422 only when the plan has no usable steps or objects, or is not JSON", async () => {
    const raw = `${"x".repeat(5000)} test-only-not-a-meta-key`;
    const previous = process.env.META_MODEL_API_KEY;
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line?: unknown) => {
      errors.push(String(line));
    });
    const still = {
      goal: "Fold an origami crane",
      imageDataUrl: `data:image/jpeg;base64,${Buffer.alloc(64, 7).toString("base64")}`,
      mimeType: "image/jpeg",
    };
    try {
      const empty = await handleInstructRequest(new Request("http://local/api/instruct", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.211" },
        body: JSON.stringify(still),
      }), {
        ask: async () => ({ status: 200, payload: { title: "Fold an origami crane", steps: [] }, rawText: raw }),
      });
      expect(empty.status).toBe(422);
      const emptyBody = await empty.json() as { schemaValid?: boolean; debug?: string; errors?: string[]; parseOk?: boolean };
      expect(emptyBody.schemaValid).toBe(false);
      expect(emptyBody.parseOk).toBe(true);
      expect(emptyBody.errors?.[0]).toMatch(/at least one step/);
      expect(emptyBody.debug?.length).toBe(INSTRUCT_DEBUG_MAX);
      expect(emptyBody.debug).not.toContain("test-only-not-a-meta-key");

      const noObjects = await handleInstructRequest(new Request("http://local/api/instruct", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.212" },
        body: JSON.stringify(still),
      }), {
        ask: async () => ({
          status: 200,
          payload: { steps: [{ instructionText: "Fold the paper.", objects: [] }] },
          rawText: raw,
        }),
      });
      expect(noObjects.status).toBe(422);
      const noObjectsBody = await noObjects.json() as { errors?: string[]; debug?: string };
      expect(noObjectsBody.errors?.[0]).toMatch(/at least one object/);
      expect(noObjectsBody.debug?.length).toBe(INSTRUCT_DEBUG_MAX);
      expect(noObjectsBody.debug).not.toContain("test-only-not-a-meta-key");

      const notJson = await handleInstructRequest(new Request("http://local/api/instruct", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.213" },
        body: JSON.stringify(still),
      }), {
        env: process.env,
        ask: async () => ({ status: 200, payload: null, rawText: raw }),
      });
      expect(notJson.status).toBe(422);
      const notJsonBody = await notJson.json() as { parseOk?: boolean; errors?: string[]; debug?: string };
      expect(notJsonBody.parseOk).toBe(false);
      expect(notJsonBody.errors?.[0]).toMatch(/not JSON/);
      expect(notJsonBody.debug?.length).toBe(INSTRUCT_DEBUG_MAX);
      expect(notJsonBody.debug).not.toContain("test-only-not-a-meta-key");
      expect(errors.join("\n")).not.toContain("test-only-not-a-meta-key");
    } finally {
      if (previous === undefined) delete process.env.META_MODEL_API_KEY;
      else process.env.META_MODEL_API_KEY = previous;
      vi.restoreAllMocks();
    }
  });

  it("overwrites the clip numbers from calls 6 and 7 and marks the still", async () => {
    const chai = structuredClone(chaiFixture) as {
      sourceClip: { mediaType: string; durationSec: number };
      steps: Array<{ sourceTimeRange: { startSec: number; endSec: number } }>;
    };
    chai.sourceClip.mediaType = "video/mp4";
    chai.sourceClip.durationSec = 9;
    chai.steps[0].sourceTimeRange = { startSec: 0, endSec: 3 };
    chai.steps[1].sourceTimeRange = { startSec: 3, endSec: 6 };
    chai.steps[2].sourceTimeRange = { startSec: 6, endSec: 9 };
    const { normalizeInstructPayload } = await import("./instruct");
    const chaiPlan = normalizeInstructPayload(chai, "Make a chai spice mix", "live");
    expect(chaiPlan.schemaValid).toBe(true);
    expect(chaiPlan.tutorial?.sourceClip.stillPlaceholder).toBe(true);
    expect(chaiPlan.tutorial?.sourceClip.mediaType).toBe("video/mp4");
    expect(chaiPlan.tutorial?.sourceClip.durationSec).toBe(8);
    expect(chaiPlan.tutorial?.steps.map((step) => [step.sourceTimeRange.startSec, step.sourceTimeRange.endSec])).toEqual([
      [0, 2.67],
      [2.67, 5.33],
      [5.33, 8],
    ]);

    const origami = structuredClone(origamiFixture) as {
      sourceClip: { mediaType: string; durationSec: number };
      generation: { toolCalls: Array<{ tool: string; modelId: string; purpose: string; inputKind: string }> };
      steps: Array<{ sourceTimeRange: { startSec: number; endSec: number } }>;
    };
    origami.sourceClip.mediaType = "video/mp4";
    origami.sourceClip.durationSec = 90;
    origami.steps[0].sourceTimeRange = { startSec: 0, endSec: 30 };
    origami.steps[1].sourceTimeRange = { startSec: 30, endSec: 60 };
    origami.steps[2].sourceTimeRange = { startSec: 60, endSec: 90 };
    origami.generation.toolCalls.push({
      tool: "sam_3_1",
      modelId: "sam-3.1",
      purpose: "segment_the_still",
      inputKind: "video_chunk",
    });
    const origamiPlan = normalizeInstructPayload(origami, "Fold an origami crane", "live");
    expect(origamiPlan.schemaValid).toBe(true);
    expect(origamiPlan.tutorial?.sourceClip.stillPlaceholder).toBe(true);
    expect(origamiPlan.tutorial?.sourceClip.durationSec).toBe(8);
    expect(origamiPlan.tutorial?.generation.toolCalls).toEqual([
      expect.objectContaining({ tool: "muse_spark", inputKind: "image" }),
    ]);
    expect(JSON.stringify(origamiPlan.tutorial?.generation.toolCalls)).not.toContain("sam_3_1");
    expect(JSON.stringify(origamiPlan.tutorial?.generation.toolCalls)).not.toContain("video_chunk");
    expect(origamiPlan.tutorial?.steps.map((step) => step.sourceTimeRange.endSec)).toEqual([2.67, 5.33, 8]);
  });

  it("never marks a Sample with the still placeholder", () => {
    const sample = validateTutorialSteps(sampleFixture);
    expect(sample.ok).toBe(true);
    if (!sample.ok) return;
    expect(sample.value.sourceClip.stillPlaceholder).toBeUndefined();
    expect(sample.value.sourceClip.durationSec).toBe(42);
    const loose = normalizeSparkPayload({
      title: "Sample · Draft",
      steps: [{ instructionText: "Cut the potato.", objects: ["potato", "knife"] }],
    }, { durationSec: 42, domain: "indian_recipe" });
    expect(loose.ok).toBe(true);
    if (!loose.ok) return;
    expect(loose.value.sourceClip.stillPlaceholder).toBeUndefined();
    expect(loose.value.sourceClip.durationSec).toBe(42);
  });

  it("keeps the shared sample schema strict", () => {
    const broken = structuredClone(chaiFixture) as { tutorialId?: string };
    broken.tutorialId = "sample-chai";
    const result = validateTutorialSteps(broken);
    expect(result.ok).toBe(false);
  });
});
