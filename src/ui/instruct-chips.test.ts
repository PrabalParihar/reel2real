import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHONE_STAND_HINT, instructHonestyChips } from "./instruct-chips";

const COPY = [
  "src/ui/instruct-chips.ts",
  "src/ui/InstructScreen.tsx",
  "src/ui/CoachScreen.tsx",
  "src/ui/Landing.tsx",
];

describe("instruction mode chips", () => {
  it("names the live plan and the SAM box, and keeps the mock label honest", () => {
    expect(instructHonestyChips(false)).toEqual({
      plan: "Live · muse-spark-1.3 plan",
      sam: "Live · SAM box",
    });
    expect(instructHonestyChips(true).plan).not.toMatch(/^Live/);
    expect(PHONE_STAND_HINT).toMatch(/phone or laptop/i);
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
