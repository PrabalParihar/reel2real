import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { durationChipLabel } from "./duration-chip";

describe("grid duration chip", () => {
  it("never renders a 0:00 or empty duration", () => {
    expect(durationChipLabel(undefined)).toBeNull();
    expect(durationChipLabel(null)).toBeNull();
    expect(durationChipLabel(Number.NaN)).toBeNull();
    expect(durationChipLabel(Number.POSITIVE_INFINITY)).toBeNull();
    expect(durationChipLabel(0)).toBeNull();
    expect(durationChipLabel(0.4)).toBeNull();
    expect(durationChipLabel(-3)).toBeNull();
    expect(durationChipLabel(5)).toBe("0:05");
    expect(durationChipLabel(8.008)).toBe("0:08");
    expect(durationChipLabel(10)).toBe("0:10");

    const landing = readFileSync("src/ui/Landing.tsx", "utf8");
    const grid = landing.slice(landing.indexOf('id="demos"'));
    expect(grid).toContain("showProgress={false}");
    expect(grid).toContain("showDuration={!sample.cardOutlines}");
    expect(grid).not.toContain("0:00");
    expect(grid).not.toMatch(/durationSec\s*[:=]\s*0/);

    const frame = readFileSync("src/ui/PhotoFrame.tsx", "utf8");
    expect(frame).toContain("durationChipLabel");
    expect(frame).toContain('className="reel-status is-duration"');
    expect(frame).not.toContain(">{durationLabel || \"0:00\"}");
  });
});
