import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLISHED_SAMPLES, SECOND_DOMAIN } from "./catalog";

describe("published samples", () => {
  it("keeps the second domain as one swappable slot", () => {
    expect(PUBLISHED_SAMPLES).toHaveLength(2);
    expect(PUBLISHED_SAMPLES[1]).toBe(SECOND_DOMAIN);
    expect(SECOND_DOMAIN.creatorName).toBe("Sample");
    expect(SECOND_DOMAIN.tutorial.sampleLabel).toBe(true);
    expect(SECOND_DOMAIN.tutorial.steps).toHaveLength(3);
  });

  it("does not hard-code the second-domain title in the screens", () => {
    for (const file of ["src/ui/Landing.tsx", "src/ui/UploadScreen.tsx", "src/ui/ExtractingScreen.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("Bike chain")).toBe(false);
      expect(source.includes("PUBLISHED_SAMPLES") || source.includes("sampleByPublishedId")).toBe(true);
    }
  });
});
