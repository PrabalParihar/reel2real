import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stepHeadlineFontPx, stepHeadlineLines } from "./step-headline";

const CHAI_STEP = "Place the stone mortar bowl on the wooden board with the stone pestle and pile of dried spices alongside.";

describe("instruct step headline", () => {
  it("keeps a long step inside four lines and leaves a short step large", () => {
    const longSize = stepHeadlineFontPx(CHAI_STEP);
    const shortSize = stepHeadlineFontPx("Crush with your hand");
    expect(longSize).toBeLessThan(shortSize);
    expect(shortSize).toBe(44);
    expect(stepHeadlineLines(CHAI_STEP, longSize)).toBeLessThanOrEqual(4);
    expect(stepHeadlineLines(CHAI_STEP, 44)).toBeGreaterThan(4);
  });

  it("sizes only the instruct headline and docks the live title to the bottom of the stage", () => {
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");
    expect(coach).toContain("stepHeadlineFontPx");
    expect(coach).toContain('<p className="hint">');
    expect(coach).not.toContain("hintStyle");
    expect(css).toContain(".hint { color: var(--wait); font-size: 15px; line-height: 1.45; }");
    expect(css).toContain(".stage-wrap.is-live .reel-title");
    expect(css).toMatch(/\.stage-wrap\.is-live \.reel-title \{[^}]*bottom:\s*10px/);
    expect(css).not.toMatch(/\.stage-wrap\.is-live \.reel-title \{[^}]*max-height/);
    expect(css).toContain(".reel-title.is-below");
  });
});
