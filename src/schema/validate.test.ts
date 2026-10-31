import { describe, expect, it } from "vitest";
import aloo from "@/src/fixtures/sample-aloo-jeera.steps.json";
import chai from "@/src/fixtures/sample-masala-chai.steps.json";
import bike from "@/src/fixtures/sample-bike-chain.steps.json";
import { normalizeSparkPayload } from "./normalize";
import { validateTutorialSteps } from "./validate";

describe("steps schema", () => {
  it("accepts the Sample aloo jeera fixture", () => {
    const result = validateTutorialSteps(aloo);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sampleLabel).toBe(true);
      expect(result.value.title.startsWith("Sample")).toBe(true);
      expect(result.value.runtimeHints?.preferredLiveMode).toBe("keyframe_still");
      for (const step of result.value.steps) {
        expect(step.credit.creditLine.length).toBeGreaterThan(0);
        expect(step.objects.length).toBeGreaterThanOrEqual(2);
        expect(step.objects.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it("accepts the Sample chai and the second-domain fixture", () => {
    expect(validateTutorialSteps(chai).ok).toBe(true);
    const second = validateTutorialSteps(bike);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.sampleLabel).toBe(true);
    expect(second.value.attribution.licence).toBe("self_filmed_sample");
    expect(second.value.attribution.creatorName).toBe("Sample");
    expect(second.value.attribution.creditLine).toBe("Sample");
    expect(second.value.steps).toHaveLength(3);
    const safety = second.value.steps.filter((step) => step.safety);
    expect(safety).toHaveLength(1);
    for (const step of second.value.steps) {
      expect(step.credit.sampleLabel).toBe(true);
      expect(step.credit.creditLine).toBe("Sample");
      expect(step.objects.length).toBeGreaterThanOrEqual(2);
      expect(step.objects.length).toBeLessThanOrEqual(4);
    }
  });

  it("accepts stills_only on the same schema", () => {
    const copy = structuredClone(chai) as typeof chai;
    copy.runtimeHints.preferredLiveMode = "stills_only";
    const result = validateTutorialSteps(copy);
    expect(result.ok).toBe(true);
  });

  it("rejects the wrong object counts", () => {
    const tooFew = structuredClone(chai) as typeof chai;
    tooFew.steps[0].objects = tooFew.steps[0].objects.slice(0, 1);
    expect(validateTutorialSteps(tooFew).ok).toBe(false);
    const tooMany = structuredClone(chai) as typeof chai;
    tooMany.steps[0].objects = [
      ...tooMany.steps[0].objects,
      { objectId: "obj_extra_a", noun: "extra", role: "optional", samPrompt: "extra one", expectedTrack: false },
      { objectId: "obj_extra_b", noun: "extra_two", role: "optional", samPrompt: "extra two", expectedTrack: false },
    ];
    expect(validateTutorialSteps(tooMany).ok).toBe(false);
  });

  it("rejects remote and instagram clip locations", () => {
    const remote = structuredClone(aloo) as typeof aloo;
    remote.sourceClip.localUri = "https://instagram.com/reel/abc";
    const result = validateTutorialSteps(remote);
    expect(result.ok).toBe(false);
  });

  it("rejects a missing credit line", () => {
    const copy = structuredClone(aloo) as typeof aloo;
    copy.steps[0].credit.creditLine = "   ";
    expect(validateTutorialSteps(copy).ok).toBe(false);
  });

  it("rejects Muse Image model ids", () => {
    const copy = structuredClone(aloo) as typeof aloo;
    copy.generation.modelId = "muse-image-1.0";
    expect(validateTutorialSteps(copy).ok).toBe(false);
  });

  it("normalizes a short Spark draft into the product schema", () => {
    const result = normalizeSparkPayload(
      {
        steps: [
          { id: "step_01", text: "Place the mortar and pestle in frame.", completion: "Both visible.", objects: ["mortar", "pestle"] },
        ],
      },
      { title: "Sample · Draft", creditLine: "Sample · self-filmed", durationSec: 12, domain: "indian_recipe" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.runtimeHints?.preferredLiveMode).toBe("keyframe_still");
      expect(result.value.steps[0].objects).toHaveLength(2);
      expect(result.value.generation.modelId).toBe("muse-spark-1.3");
    }
  });
});
