import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PHONE_STAND_HINT, instructHonestyChips, instructSamChip, instructSamOverlay, instructSamPhase, nextSamView } from "./instruct-chips";

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
    expect(instructSamChip(false, "waiting")).toBe("Checking");
    expect(instructSamChip(false, "box")).toBe("Live · SAM box");
    expect(instructSamChip(false, "failed")).toBe("SAM unavailable");
    expect(instructSamChip(true, "box")).toBe("SAM box");
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    expect(coach).toContain("instructSamChip");
    expect(coach).toContain("instructSamOverlay");
    expect(coach).not.toContain("honesty.sam");
  });

  it("keeps the last boxes when a later check fails, and clears a miss that never drew", () => {
    let afterSuccess = nextSamView({ boxDrawn: false, failed: false }, "success");
    afterSuccess = nextSamView(afterSuccess, "failure");
    expect(instructSamPhase(afterSuccess)).toBe("stale");
    expect(instructSamChip(false, "stale")).toBe("Last check");
    expect(instructSamOverlay("stale", "Highlights unavailable")).toBe("Last check");
    expect(afterSuccess.boxDrawn).toBe(true);

    const missed = nextSamView({ boxDrawn: false, failed: false }, "failure");
    expect(instructSamPhase(missed)).toBe("failed");
    expect(instructSamChip(false, "failed")).toBe("SAM unavailable");
    expect(instructSamOverlay("failed", "Checking…")).toBe("Highlights unavailable");
    expect(missed.boxDrawn).toBe(false);

    const recovered = nextSamView(missed, "success");
    expect(instructSamPhase(recovered)).toBe("box");
    expect(instructSamChip(false, "box")).toBe("Live · SAM box");
    expect(instructSamOverlay("box", "Watching")).toBe("Watching");
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
