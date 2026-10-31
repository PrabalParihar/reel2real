import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeMaskToRaster } from "@meta-sam/parser";
import { DEMOS } from "./demos";
import { assessMask, MIN_BOX_FILL, MIN_FRAME_FRACTION } from "./mask-sanity";
import { selectMaskRecord, type SamStepFile } from "./scene";

function loadSam(demo: string, file: string): SamStepFile {
  return JSON.parse(readFileSync(`public/samples/${demo}/${file}`, "utf8")) as SamStepFile;
}

function onPixels(mask: { encoding: "one_bit" | "lossless"; width: number; height: number; payload: string }): number {
  const raster = decodeMaskToRaster(mask);
  let count = 0;
  for (const value of raster) if (value) count += 1;
  return count;
}

describe("drawn mask sanity", () => {
  it("rejects a speck and a sparse box, and keeps a real object", () => {
    const speck = assessMask(203, { x1: 395, y1: 309, x2: 408, y2: 336 });
    expect(speck.frameFraction).toBeLessThan(MIN_FRAME_FRACTION);
    expect(speck.pass).toBe(false);
    const sparse = assessMask(1122, { x1: 377, y1: 248, x2: 576, y2: 363 });
    expect(sparse.boxFill).toBeLessThan(MIN_BOX_FILL);
    expect(sparse.pass).toBe(false);
    const mortar = assessMask(49197, { x1: 221, y1: 85, x2: 568, y2: 380 });
    expect(mortar.pass).toBe(true);
    const sliver = assessMask(2000, { x1: 0, y1: 100, x2: 20, y2: 300 });
    expect(sliver.edgeSliver).toBe(true);
    expect(sliver.pass).toBe(false);
  });

  it("accepts every mask the demos still draw", () => {
    expect(DEMOS.reduce((count, demo) => count + demo.scene.steps.length, 0)).toBe(15);
    const chai = DEMOS.find((demo) => demo.slug === "masala-chai");
    expect(chai?.scene.steps[2].nouns.every((noun) => noun.verified === false)).toBe(true);
    for (const demo of DEMOS) {
      demo.scene.steps.forEach((step, index) => {
        const file = loadSam(demo.slug, step.samFile);
        for (const noun of step.nouns) {
          const selected = selectMaskRecord(file.calls, noun);
          if (!selected) continue;
          const verdict = assessMask(onPixels(selected.mask), selected.box, selected.box.frameW, selected.box.frameH);
          expect(verdict.pass, `${demo.slug} step ${index + 1} ${noun.noun} area ${verdict.onPixels}`).toBe(true);
        }
      });
    }
  });
});
