import { describe, expect, it, vi } from "vitest";
import { tutorialFromSparkPayload } from "@/src/schema/attribution";
import { validateTutorialSteps } from "@/src/schema/validate";
import chaiFixture from "@/src/fixtures/instruct-chai.muse.json";
import origamiFixture from "@/src/fixtures/instruct-origami.muse.json";
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
    expect(strictMessages(chaiFixture)).toEqual(CHAI_ERRORS);
    expect(CHAI_ERRORS.filter((message) => message.includes("allowed values"))).toHaveLength(14);
    const { normalizeInstructPayload } = await import("./instruct");
    const result = normalizeInstructPayload(chaiFixture, "Make a chai spice mix", "live", 0, "{\"title\":\"Make a chai spice mix\"}");
    expect(result.schemaValid).toBe(true);
    expect(result.parseOk).toBe(true);
    expect(result.tutorial?.tutorialId).toBe("instruct-make-a-chai-spice-mix");
    expect(result.tutorial?.domain).toBe("indian_recipe");
    expect(result.tutorial?.sourceClip.mediaType).toBe("video/mp4");
    expect(result.tutorial?.steps[0].objects[0].role).toBe("required_present");
    expect(result.tutorial?.steps[0].successCheck.kind).toBe("all_required_present");
    expect(result.debug).toBeUndefined();
  });

  it("reproduces the origami error list, then accepts it after normalising", async () => {
    expect(strictMessages(origamiFixture)).toEqual(ORIGAMI_ERRORS);
    expect(ORIGAMI_ERRORS.filter((message) => message.includes("allowed values"))).toHaveLength(14);
    expect(ORIGAMI_ERRORS.filter((message) => message === "must be > 0")).toHaveLength(4);
    const { normalizeInstructPayload } = await import("./instruct");
    const result = normalizeInstructPayload(origamiFixture, "Fold an origami crane", "live");
    expect(result.schemaValid).toBe(true);
    expect(result.tutorial?.tutorialId).toBe("instruct-fold-an-origami-crane");
    expect(result.tutorial?.domain).toBe("non_cooking_diy");
    expect(result.tutorial?.sourceClip.durationSec).toBeGreaterThan(0);
    for (const step of result.tutorial?.steps ?? []) {
      expect(step.sourceTimeRange.endSec).toBeGreaterThan(0);
    }
  });

  it("still rejects an enum that cannot be mapped, with a capped debug field", async () => {
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
      expect(response.status).toBe(422);
      const body = await response.json() as { schemaValid?: boolean; debug?: string; errors?: string[] };
      expect(body.schemaValid).toBe(false);
      expect(body.errors?.some((message) => message.includes("allowed values"))).toBe(true);
      expect(body.debug?.length).toBe(INSTRUCT_DEBUG_MAX);
      expect(body.debug).not.toContain("test-only-not-a-meta-key");
      expect(errors.some((line) => line.includes("path=/steps/0/objects/0/role") && line.includes("not_a_role"))).toBe(true);
      expect(errors.join("\n")).not.toContain("test-only-not-a-meta-key");
    } finally {
      if (previous === undefined) delete process.env.META_MODEL_API_KEY;
      else process.env.META_MODEL_API_KEY = previous;
      vi.restoreAllMocks();
    }
  });

  it("keeps the shared sample schema strict", () => {
    const broken = structuredClone(chaiFixture) as { tutorialId?: string };
    broken.tutorialId = "sample-chai";
    const result = validateTutorialSteps(broken);
    expect(result.ok).toBe(false);
  });
});
