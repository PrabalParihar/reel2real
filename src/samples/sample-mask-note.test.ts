import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS } from "./demos";
import {
  presentNouns,
  RECORDED_SAM_LABEL,
  SAMPLE_NO_HIGHLIGHTS_LABEL,
  sampleFrameNote,
  unverifiedStep,
  unverifiedStepHint,
  type SceneStep,
} from "./scene";

const OUTLINE_WORDS = /highlight|outlin|boxed|\bbox(?:ed|es)?\b/i;

function demo(slug: string) {
  const found = DEMOS.find((item) => item.slug === slug);
  if (!found) throw new Error(`missing ${slug}`);
  return found;
}

function overlayNouns(step: SceneStep) {
  return presentNouns(step).filter((noun) => noun.verified !== false);
}

describe("sample steps with no verified overlay", () => {
  it("shows the no-highlights note and no overlay on latte steps 1 and 3", () => {
    const latte = demo("latte-art");
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    expect(coach).toContain("noVerifiedMask\n    ? sampleFrameNote(true)");
    expect(coach).toContain("overlay={verifiedNouns.length ? { samUrl: sceneAsset(scene, sceneStep.samFile), nouns: verifiedNouns } : null}");
    expect(coach).toContain('status={onVideoStatus}');
    for (const index of [0, 2]) {
      const step = latte.scene.steps[index];
      expect(unverifiedStep(step.nouns)).toBe(true);
      expect(sampleFrameNote(true)).toBe(SAMPLE_NO_HIGHLIGHTS_LABEL);
      expect(SAMPLE_NO_HIGHLIGHTS_LABEL).toBe("Sample · no highlights for this step");
      expect(overlayNouns(step)).toEqual([]);
    }
  });

  it("shows the no-highlights note on masala chai step 3 and origami step 3", () => {
    const chai = demo("masala-chai").scene.steps[2];
    const origami = demo("origami").scene.steps[2];
    for (const step of [chai, origami]) {
      expect(unverifiedStep(step.nouns)).toBe(true);
      expect(sampleFrameNote(true)).toBe("Sample · no highlights for this step");
      expect(overlayNouns(step)).toEqual([]);
    }
    expect(chai.nouns.map((noun) => noun.noun)).toEqual(["spices"]);
    expect(origami.nouns.map((noun) => noun.noun)).toEqual(["crane"]);
  });

  it("keeps the hand overlay and recorded label on masala chai step 2", () => {
    const step = demo("masala-chai").scene.steps[1];
    expect(unverifiedStep(step.nouns)).toBe(false);
    expect(step.nouns.find((noun) => noun.noun === "spices")?.verified).toBe(false);
    expect(step.nouns.find((noun) => noun.noun === "hand")?.verified).toBe(true);
    expect(sampleFrameNote(false)).toBe(RECORDED_SAM_LABEL);
    expect(overlayNouns(step).map((noun) => noun.noun)).toEqual(["hand"]);
  });

  it("shows the recorded label and overlay on latte step 2", () => {
    const step = demo("latte-art").scene.steps[1];
    expect(unverifiedStep(step.nouns)).toBe(false);
    expect(sampleFrameNote(false)).toBe(RECORDED_SAM_LABEL);
    expect(RECORDED_SAM_LABEL).toBe("Sample · recorded SAM output");
    expect(overlayNouns(step).map((noun) => noun.noun)).toEqual(["cup"]);
    expect(step.samFile).toBe("sam/step-2.json");
  });

  it("keeps outline and highlight wording out of unverified hints", () => {
    for (const item of DEMOS) {
      for (const step of item.scene.steps) {
        if (!unverifiedStep(step.nouns)) continue;
        const hint = unverifiedStepHint(step.nouns);
        expect(hint, `${item.slug} ${step.samFile}`).not.toMatch(OUTLINE_WORDS);
        expect(hint.startsWith("Keep the ")).toBe(true);
        expect(hint.endsWith("fully in frame")).toBe(true);
      }
    }
    expect(unverifiedStepHint(demo("latte-art").scene.steps[0].nouns)).toBe("Keep the cup fully in frame");
    expect(unverifiedStepHint(demo("latte-art").scene.steps[2].nouns)).toBe("Keep the cup fully in frame");
  });

  it("leaves a verified chai step and a verified origami step unchanged", () => {
    const chai = demo("masala-chai").scene.steps[0];
    const origami = demo("origami").scene.steps[0];
    expect(unverifiedStep(chai.nouns)).toBe(false);
    expect(unverifiedStep(origami.nouns)).toBe(false);
    expect(sampleFrameNote(false)).toBe("Sample · recorded SAM output");
    expect(overlayNouns(chai).map((noun) => noun.noun)).toEqual(["mortar", "pestle"]);
    expect(overlayNouns(origami).map((noun) => noun.noun)).toEqual(["paper"]);
    expect(chai.nouns.every((noun) => noun.verified === true)).toBe(true);
    expect(origami.nouns.every((noun) => noun.verified === true)).toBe(true);
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    expect(coach.indexOf("? sampleFrameNote(true)")).toBeLessThan(coach.indexOf("? recordedStatus"));
    expect(coach).toContain("? RECORDED_SAM_LABEL");
  });

  it("does not change the verified flags in steps.json", () => {
    const actual: Record<string, Array<{ samFile: string; nouns: Array<{ noun: string; verified: boolean | undefined }> }>> = {};
    for (const name of readdirSync("public/samples").sort()) {
      const dir = `public/samples/${name}`;
      if (!statSync(dir).isDirectory()) continue;
      const scene = JSON.parse(readFileSync(`${dir}/steps.json`, "utf8")) as {
        steps: Array<{ samFile: string; nouns?: Array<{ noun: string; verified?: boolean }> }>;
      };
      actual[name] = scene.steps.map((step) => ({
        samFile: step.samFile,
        nouns: (step.nouns ?? []).map((noun) => ({ noun: noun.noun, verified: noun.verified })),
      }));
    }
    expect(actual).toEqual({
      "flask-colour": [
        { samFile: "sam/step-1.json", nouns: [{ noun: "flask", verified: true }, { noun: "bottle", verified: true }] },
        { samFile: "sam/step-2.json", nouns: [{ noun: "flask", verified: true }, { noun: "bottle", verified: true }] },
        { samFile: "sam/step-3.json", nouns: [{ noun: "rod", verified: false }, { noun: "flask", verified: true }] },
      ],
      "latte-art": [
        { samFile: "sam/step-1.json", nouns: [{ noun: "cup", verified: false }] },
        { samFile: "sam/step-2.json", nouns: [{ noun: "cup", verified: true }] },
        { samFile: "sam/step-3.json", nouns: [{ noun: "cup", verified: false }] },
      ],
      "masala-chai": [
        { samFile: "sam/step-1.json", nouns: [{ noun: "mortar", verified: true }, { noun: "pestle", verified: true }] },
        { samFile: "sam/step-2.json", nouns: [{ noun: "spices", verified: false }, { noun: "hand", verified: true }, { noun: "hand", verified: false }] },
        { samFile: "sam/step-3.json", nouns: [{ noun: "spices", verified: false }] },
      ],
      origami: [
        { samFile: "sam/step-1.json", nouns: [{ noun: "paper", verified: true }] },
        { samFile: "sam/step-2.json", nouns: [{ noun: "heart", verified: true }] },
        { samFile: "sam/step-3.json", nouns: [{ noun: "crane", verified: false }] },
      ],
      "seed-planting": [
        { samFile: "sam/step-1.json", nouns: [{ noun: "gloves", verified: true }, { noun: "gloves", verified: true }, { noun: "tray", verified: true }] },
        { samFile: "sam/step-2.json", nouns: [{ noun: "gloves", verified: true }, { noun: "gloves", verified: true }] },
        { samFile: "sam/step-3.json", nouns: [{ noun: "jar", verified: true }, { noun: "gloves", verified: true }, { noun: "gloves", verified: true }] },
      ],
    });
  });
});
