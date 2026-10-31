import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS } from "@/src/samples/demos";
import { PUBLISHED_SAMPLES } from "./catalog";

const UI_COPY = ["src/ui/Landing.tsx", "src/fsm/ui.ts", "src/ui/CoachScreen.tsx", "src/ui/UploadScreen.tsx", "src/ui/chrome.tsx"];

describe("published samples", () => {
  it("publishes demos only from the catalog data", () => {
    expect(DEMOS.length).toBeGreaterThanOrEqual(1);
    expect(DEMOS.length).toBeLessThanOrEqual(5);
    expect(PUBLISHED_SAMPLES).toHaveLength(DEMOS.length);
    expect(PUBLISHED_SAMPLES.map((item) => item.id)).toEqual(DEMOS.map((demo) => demo.slug));
    expect(PUBLISHED_SAMPLES.some((item) => item.id === "bike-chain")).toBe(false);
    for (const sample of PUBLISHED_SAMPLES) {
      expect(sample.stepCrops.length).toBe(sample.scene.steps.length);
      expect(sample.creatorName.length).toBeGreaterThan(0);
      expect(sample.clip.length).toBeGreaterThan(0);
      expect(sample.tutorial.sampleLabel).toBe(true);
    }
  });

  it("does not tell the user that boxes are pixel masks", () => {
    for (const file of UI_COPY) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("Keyframe masks")).toBe(false);
      expect(source.includes("isn't masked")).toBe(false);
      expect(source.includes("Not masked")).toBe(false);
      expect(source.includes("Mask lost")).toBe(false);
      expect(source.includes("Cook along")).toBe(false);
    }
    expect(readFileSync("src/ui/Landing.tsx", "utf8")).toContain("Follow along");
    expect(readFileSync("src/ui/Landing.tsx", "utf8")).toContain("Keyframe highlights");
  });

  it("does not hard-code the second-domain title in the screens", () => {
    for (const file of ["src/ui/Landing.tsx", "src/ui/UploadScreen.tsx", "src/ui/ExtractingScreen.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("Bike chain")).toBe(false);
      expect(source.includes("PUBLISHED_SAMPLES") || source.includes("sampleByPublishedId")).toBe(true);
    }
  });
});
