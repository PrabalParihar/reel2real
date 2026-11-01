import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hidesClipTiming } from "./clip-timing";
import { shouldCacheSteps } from "./steps-cache";

describe("still placeholder timing", () => {
  it("hides clip timing for an instruct still and shows it for a real clip", () => {
    expect(hidesClipTiming({ stepsSource: "instruct", stillPlaceholder: true })).toBe(true);
    expect(hidesClipTiming({ stepsSource: "instruct", stillPlaceholder: false })).toBe(true);
    expect(hidesClipTiming({ stepsSource: "clip", stillPlaceholder: true })).toBe(true);
    expect(hidesClipTiming({ stepsSource: "clip" })).toBe(false);
    expect(hidesClipTiming({ stepsSource: "sample" })).toBe(false);
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    const done = readFileSync("src/ui/DoneScreen.tsx", "utf8");
    expect(coach).toContain("hidesClipTiming");
    expect(done).toContain("hidesClipTiming");
    expect(done).toContain('session.stepsSource === "clip"');
  });

  it("refuses to cache a still stand-in", () => {
    expect(shouldCacheSteps({
      inputKind: "clip",
      tutorial: { sourceClip: { stillPlaceholder: true } },
    })).toBe(false);
    expect(shouldCacheSteps({
      inputKind: "instruct",
      tutorial: { sourceClip: {} },
    })).toBe(false);
    expect(shouldCacheSteps({
      inputKind: "clip",
      tutorial: { sourceClip: {} },
    })).toBe(true);
    expect(shouldCacheSteps({
      inputKind: "sample",
      tutorial: { sourceClip: {} },
    })).toBe(true);
  });
});
