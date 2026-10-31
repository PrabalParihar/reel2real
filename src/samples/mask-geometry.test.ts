import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeMaskToRaster } from "@meta-sam/parser";
import { contourLoops, coverTransform, framePathFromPayload, framePathFromRaster, frameToView, objectPositionForPoint, smoothMask } from "./mask-geometry";
import { heroNouns, SAMPLE_SCENES, selectMaskRecord, tutorialFromScene, type SamStepFile, type SceneNoun } from "./scene";

function loadSam(demo: string, file: string): SamStepFile {
  return JSON.parse(readFileSync(`public/samples/${demo}/${file}`, "utf8")) as SamStepFile;
}

describe("cover transform", () => {
  it("centers a 720x405 frame in a 1440x900 view", () => {
    const cover = coverTransform(720, 405, 1440, 900);
    expect(cover.top).toBeCloseTo(0);
    expect(cover.height).toBeCloseTo(900);
    expect(cover.width).toBeGreaterThan(1440);
    expect(cover.left).toBeLessThan(0);
    const center = frameToView(360, 202.5, 720, 405, cover);
    expect(center.x).toBeCloseTo(720);
    expect(center.y).toBeCloseTo(450);
  });

  it("centers the same frame in a 390x844 view", () => {
    const cover = coverTransform(720, 405, 390, 844);
    const center = frameToView(360, 202.5, 720, 405, cover);
    expect(center.x).toBeCloseTo(195);
    expect(center.y).toBeCloseTo(422);
    expect(cover.scale).toBeCloseTo(844 / 405);
  });
});

describe("mask to path", () => {
  it("traces a solid block instead of its bounding box alone", () => {
    const width = 12;
    const height = 12;
    const raster = new Uint8Array(width * height);
    for (let y = 1; y < 11; y += 1) {
      for (let x = 1; x < 11; x += 1) raster[y * width + x] = 1;
    }
    const draw = framePathFromRaster(raster, width, height, { x1: 0, y1: 0, x2: width, y2: height }, false);
    expect(draw.d.startsWith("M ")).toBe(true);
    expect(draw.d.includes("Z")).toBe(true);
    expect(draw.d.split(" L ").length).toBeGreaterThan(4);
    expect(draw.centroid?.x).toBeGreaterThan(4);
    expect(draw.centroid?.x).toBeLessThan(8);
    const loops = contourLoops(raster, width, height);
    expect(loops.length).toBeGreaterThan(0);
  });

  it("decodes a recorded one_bit mask into a contour inside its box", () => {
    const scene = SAMPLE_SCENES[0];
    const noun = scene.steps[0].nouns[0];
    const file = loadSam(scene.demo, scene.steps[0].samFile);
    const selected = selectMaskRecord(file.calls, noun);
    expect(selected?.call.requestId).toBe(noun.requestId);
    expect(selected?.call.present).toBe(true);
    const raster = decodeMaskToRaster(selected!.mask);
    expect(raster.length).toBe(selected!.mask.width * selected!.mask.height);
    expect(raster.some((value) => value === 1)).toBe(true);
    const smoothed = smoothMask(raster, selected!.mask.width, selected!.mask.height);
    expect(smoothed.some((value) => value === 1)).toBe(true);
    const draw = framePathFromPayload(selected!.mask, selected!.box);
    expect(draw.d.length).toBeGreaterThan(40);
    expect(draw.centroid).not.toBeNull();
    expect(draw.centroid!.x).toBeGreaterThan(selected!.box.x1);
    expect(draw.centroid!.x).toBeLessThan(selected!.box.x2);
    expect(draw.centroid!.y).toBeGreaterThan(selected!.box.y1);
    expect(draw.centroid!.y).toBeLessThan(selected!.box.y2);
    expect(draw.d).not.toMatch(/rect/i);
  });

  it("ignores a recorded miss when the noun is marked absent", () => {
    const scene = SAMPLE_SCENES[0];
    const noun = { ...scene.steps[0].nouns[0], present: false };
    const file = loadSam(scene.demo, scene.steps[0].samFile);
    expect(selectMaskRecord(file.calls, noun)).toBeNull();
  });
});

describe("vertical crop", () => {
  it("keeps a focal point centered after a 9:16 cover crop", () => {
    const focal = { x: 398, y: 245 };
    const position = objectPositionForPoint(focal.x, focal.y, 720, 405, 360, 640);
    const cover = coverTransform(720, 405, 360, 640, position);
    const view = frameToView(focal.x, focal.y, 720, 405, cover);
    expect(view.x).toBeCloseTo(180, 0);
    expect(view.y).toBeGreaterThanOrEqual(-1);
    expect(view.y).toBeLessThanOrEqual(641);
    expect(cover.left).toBeLessThanOrEqual(0);
    const wide = coverTransform(720, 405, 360, 640, { x: 0.5, y: 0.5 }, 0.5);
    expect(wide.height).toBeLessThan(640);
    expect(wide.top).toBeGreaterThan(0);
    const pinned = coverTransform(720, 405, 360, 640, { x: 0, y: 0.5 });
    expect(pinned.left).toBeCloseTo(0);
    const end = coverTransform(720, 405, 360, 640, { x: 1, y: 0.5 });
    expect(end.left).toBeCloseTo(360 - end.width);
  });
});

describe("scene tutorials", () => {
  it("builds both demos from public steps.json", () => {
    for (const scene of SAMPLE_SCENES) {
      const tutorial = tutorialFromScene(scene);
      expect(tutorial.sampleLabel).toBe(true);
      expect(tutorial.title).toBe(scene.title);
      expect(tutorial.steps.map((step) => step.instructionText)).toEqual(scene.steps.map((step) => step.title));
      expect(tutorial.sourceClip.localUri?.startsWith("http")).toBe(false);
      scene.steps.forEach((step, index) => {
        expect(tutorial.steps[index].objects.map((object) => object.samPrompt)).toEqual(
          step.nouns.filter((noun) => noun.present).map((noun) => noun.samPrompt),
        );
      });
    }
    const chai = SAMPLE_SCENES.find((scene) => scene.demo === "masala-chai");
    expect(heroNouns(chai!).map((noun) => noun.noun)).toEqual(["mortar"]);
    expect(SAMPLE_SCENES.some((scene) => scene.demo === "bike-chain")).toBe(false);
  });
});
