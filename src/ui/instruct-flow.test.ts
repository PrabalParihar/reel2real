import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_OUTLINE_CAPTION } from "./SampleCoachStill";
import { INSTRUCT_GOALS, instructPrimary, instructProgress, planStepsEnabled } from "./instruct-flow";

function uiFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...uiFiles(full));
    else if (name.endsWith(".tsx")) found.push(full);
  }
  return found;
}

describe("instruction flow", () => {
  it("keeps Plan steps off until a goal and a still are both present", () => {
    expect(planStepsEnabled("", false)).toBe(false);
    expect(planStepsEnabled("Make a chai spice mix", false)).toBe(false);
    expect(planStepsEnabled("   ", true)).toBe(false);
    expect(planStepsEnabled("Make a chai spice mix", true)).toBe(true);
    expect(instructPrimary({ cameraLive: false, hasStill: false, goal: "" })).toBe("allow");
    expect(instructPrimary({ cameraLive: true, hasStill: false, goal: "Make a chai spice mix" })).toBe("capture");
    expect(instructPrimary({ cameraLive: false, hasStill: true, goal: "Make a chai spice mix" })).toBe("plan");
    expect(instructPrimary({ cameraLive: true, hasStill: true, goal: "Make a chai spice mix" })).toBe("plan");
  });

  it("fills the goal from the sample domain chips", () => {
    expect(INSTRUCT_GOALS).toEqual([
      "Make a chai spice mix",
      "Pour latte art",
      "Fold an origami crane",
      "Plant seeds in a tray",
    ]);
    const screen = readFileSync("src/ui/InstructScreen.tsx", "utf8");
    for (const goal of INSTRUCT_GOALS) {
      expect(screen).toContain("INSTRUCT_GOALS");
      expect(INSTRUCT_GOALS).toContain(goal);
    }
    const filled = INSTRUCT_GOALS[2];
    expect(planStepsEnabled(filled, false)).toBe(false);
    expect(instructProgress(filled, false).map((step) => step.state)).toEqual(["done", "current", "wait"]);
    expect(instructProgress("", false).map((step) => step.id)).toEqual(["Goal", "Still", "Coach"]);
  });

  it("captions the sample still and keeps the hero under the sticky header", () => {
    expect(SAMPLE_OUTLINE_CAPTION).toBe("Sample: recorded outlines. Live coach draws a box.");
    expect(SAMPLE_OUTLINE_CAPTION).not.toMatch(/[—–]/);
    const still = readFileSync("src/ui/SampleCoachStill.tsx", "utf8");
    expect(still).toContain("SAMPLE_OUTLINE_CAPTION");
    expect(still).toContain('className="quiet"');
    expect(readFileSync("src/ui/InstructScreen.tsx", "utf8")).toContain("SampleCoachStill");
    expect(readFileSync("src/ui/Landing.tsx", "utf8")).toContain("SampleCoachStill");
    const css = readFileSync("app/globals.css", "utf8");
    const nav = css.match(/\.nav-wrap\s*\{[^}]+\}/)?.[0] ?? "";
    expect(nav).toMatch(/position:\s*sticky/);
    expect(nav).toMatch(/z-index:\s*40/);
    expect(nav).toMatch(/background:\s*var\(--bg\)/);
    const below = css.match(/\.landing > :not\(\.nav-wrap\)\s*\{[^}]+\}/)?.[0] ?? "";
    expect(below).toMatch(/z-index:\s*0/);
    expect(below).toMatch(/isolation:\s*isolate/);
  });

  it("has no Gate 0 string in UI copy", () => {
    const files = [...uiFiles("src/ui"), ...uiFiles("app")];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/Gate 0/i);
      expect(text, file).not.toMatch(/WitLabs/i);
      expect(text, file).not.toMatch(/Ray-Ban|glasses/i);
      expect(text, file).not.toContain("\u2014");
      expect(text, file).not.toContain("\u2013");
    }
  });
});
