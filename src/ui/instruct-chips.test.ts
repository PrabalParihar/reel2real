import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHONE_STAND_HINT, instructHonestyChips, instructSamChip, instructSamPhase } from "./instruct-chips";

const COPY = [
  "src/ui/instruct-chips.ts",
  "src/ui/InstructScreen.tsx",
  "src/ui/CoachScreen.tsx",
  "src/ui/Landing.tsx",
];

describe("instruction mode chips", () => {
  it("names the live plan and keeps the mock label honest", () => {
    expect(instructHonestyChips(false).plan).toBe("Live · muse-spark-1.3 plan");
    expect(instructHonestyChips(true).plan).not.toMatch(/^Live/);
    expect(PHONE_STAND_HINT).toMatch(/phone or laptop/i);
  });

  it("follows the real SAM state", () => {
    expect(instructSamPhase({ failed: false, boxDrawn: false })).toBe("waiting");
    expect(instructSamPhase({ failed: false, boxDrawn: true })).toBe("box");
    expect(instructSamPhase({ failed: true, boxDrawn: true })).toBe("failed");
    expect(instructSamChip(false, "waiting")).toBe("Checking");
    expect(instructSamChip(false, "box")).toBe("Live · SAM box");
    expect(instructSamChip(false, "failed")).toBe("SAM unavailable");
    expect(instructSamChip(true, "waiting")).toBe("Checking");
    expect(instructSamChip(true, "box")).toBe("SAM box");
    expect(instructSamChip(true, "failed")).toBe("SAM unavailable");
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    expect(coach).toContain("instructSamChip");
    expect(coach).not.toContain("honesty.sam");
  });

  it("does not claim glasses, contours, or a scraped reel", () => {
    for (const file of COPY) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/Ray-Ban|glasses|contour|WitLabs/i);
      expect(text, file).not.toContain("\u2014");
      expect(text, file).not.toContain("\u2013");
    }
  });
});
