import { describe, expect, it } from "vitest";
import chai from "@/src/fixtures/sample-masala-chai.steps.json";
import { tutorialFromSparkPayload } from "./attribution";

describe("user attribution", () => {
  it("discards attribution invented by the model", () => {
    const poisoned = structuredClone(chai) as typeof chai;
    poisoned.attribution = {
      creatorName: "Sample cook",
      creditLine: "invented by the model",
      licence: "self_filmed_sample",
    };
    poisoned.sampleLabel = true;
    poisoned.steps[0].credit = {
      creditLine: "invented by the model",
      creatorName: "Sample cook",
      sampleLabel: true,
    };

    const result = tutorialFromSparkPayload(poisoned, {
      creatorName: "A. Creator",
      licence: "permission_granted",
      creditLink: "https://example.com/credit",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const dumped = JSON.stringify(result.value);
    expect(result.value.attribution.creatorName).toBe("A. Creator");
    expect(result.value.attribution.licence).toBe("written_permission");
    expect(result.value.attribution.creditLine).toContain("A. Creator");
    expect(result.value.attribution.creditLine).toContain("https://example.com/credit");
    expect(result.value.sampleLabel).toBe(false);
    for (const step of result.value.steps) {
      expect(step.credit.creatorName).toBe("A. Creator");
      expect(step.credit.creditLine).toBe(result.value.attribution.creditLine);
      expect(step.credit.sampleLabel).toBe(false);
    }
    expect(dumped).not.toContain("Sample cook");
    expect(dumped).not.toContain("invented by the model");
    expect(dumped).not.toContain("self_filmed_sample");
  });
});
