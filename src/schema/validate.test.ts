import { describe, expect, it } from "vitest";
import aloo from "@/src/fixtures/sample-aloo-jeera.steps.json";
import { SAMPLE_SCENES, tutorialFromScene } from "@/src/samples/scene";
import { normalizeSparkPayload } from "./normalize";
import { validateTutorialSteps } from "./validate";

const chai = tutorialFromScene(SAMPLE_SCENES[0]);
const bike = tutorialFromScene(SAMPLE_SCENES.find((scene) => scene.demo === "bike-chain") ?? SAMPLE_SCENES[1]);

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
    const bikeScene = SAMPLE_SCENES.find((scene) => scene.demo === "bike-chain");
    expect(second.value.sampleLabel).toBe(true);
    expect(second.value.attribution.licence).toBe("other_cleared");
    expect(second.value.attribution.creatorName).toBe(bikeScene?.sourceClip.author);
    expect(second.value.steps.map((step) => step.instructionText)).toEqual(bikeScene?.steps.map((step) => step.title));
    expect(second.value.steps.map((step) => step.objects.map((object) => object.noun))).toEqual(
      bikeScene?.steps.map((step) => step.nouns.filter((noun) => noun.present).map((noun) => noun.noun)),
    );
    expect(second.value.steps).toHaveLength(3);
    for (const step of second.value.steps) {
      expect(step.credit.sampleLabel).toBe(true);
      expect(step.objects.length).toBeLessThanOrEqual(4);
      for (const object of step.objects) {
        expect(object.noun.toLowerCase()).not.toMatch(/cassette|sprocket|rag|lube/);
      }
    }
    const chaiScene = SAMPLE_SCENES.find((scene) => scene.demo === "masala-chai");
    expect(chai.steps.map((step) => step.instructionText)).toEqual(chaiScene?.steps.map((step) => step.title));
    expect(JSON.stringify(chai.steps)).not.toMatch(/ginger|cardamom|\bcup\b/);
  });

  it("accepts stills_only on the same schema", () => {
    const copy = structuredClone(chai) as typeof chai;
    if (!copy.runtimeHints) throw new Error("runtime hints missing");
    copy.runtimeHints.preferredLiveMode = "stills_only";
    const result = validateTutorialSteps(copy);
    expect(result.ok).toBe(true);
  });

  it("rejects the wrong object counts", () => {
    const empty = structuredClone(chai);
    empty.steps[0].objects = [];
    empty.steps[0].successCheck = { kind: "all_required_present", description: "Needs nouns.", requiredObjectIds: [] };
    expect(validateTutorialSteps(empty).ok).toBe(false);
    const manual = structuredClone(chai);
    manual.steps[0].objects = [];
    manual.steps[0].successCheck = { kind: "manual_confirm_only", description: "No highlight on this frame." };
    expect(validateTutorialSteps(manual).ok).toBe(true);
    const tooMany = structuredClone(chai);
    tooMany.steps[0].objects = [
      ...tooMany.steps[0].objects,
      { objectId: "obj_extra_a", noun: "extra", role: "optional", samPrompt: "extra one", expectedTrack: false },
      { objectId: "obj_extra_b", noun: "extra_two", role: "optional", samPrompt: "extra two", expectedTrack: false },
      { objectId: "obj_extra_c", noun: "extra_three", role: "optional", samPrompt: "extra three", expectedTrack: false },
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
