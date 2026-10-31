import { describe, expect, it } from "vitest";
import { DEMOS } from "./demos";
import { durationChipLabel } from "@/src/ui/duration-chip";
import { readLoopDuration } from "./mp4-duration";

describe("stored loop durations", () => {
  it("matches each hero-loop.mp4 within 0.05s and rounds the chip down", () => {
    const expected: Record<string, string> = {
      "masala-chai": "0:05",
      "flask-colour": "0:10",
      origami: "0:08",
      "seed-planting": "0:08",
    };
    for (const demo of DEMOS) {
      const file = `public/samples/${demo.slug}/hero-loop.mp4`;
      if (demo.slug === "latte-art") {
        expect(demo.loopDurationSec).toBeUndefined();
        expect(demo.cardOutlines).toBe(true);
        expect(durationChipLabel(demo.cardOutlines ? undefined : demo.loopDurationSec)).toBeNull();
        continue;
      }
      const measured = readLoopDuration(file);
      expect(demo.loopDurationSec, demo.slug).toBeTypeOf("number");
      expect(Math.abs(measured - demo.loopDurationSec!)).toBeLessThanOrEqual(0.05);
      expect(durationChipLabel(demo.loopDurationSec)).toBe(expected[demo.slug]);
    }
  });
});
