import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeMaskToRaster } from "@meta-sam/parser";
import { clipPathToRect, contourLoops, coverTransform, framePathFromPayload, framePathFromRaster, frameToView, objectPositionForPoint, smoothMask, visibleFrameRect } from "./mask-geometry";
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

  it("draws the recorded instance named by maskOrdinal and hides an unverified box", () => {
    const noun = {
      objectId: "obj_paper",
      noun: "paper",
      samPrompt: "paper",
      color: "#E88C30",
      present: true,
      verified: true,
      requestId: "req",
      maskOrdinal: "6",
    };
    const calls = [{
      requestId: "req",
      noun: "paper",
      present: true,
      records: [
        { ordinal: "0", box: { x1: 1, y1: 1, x2: 4, y2: 4, frameW: 720, frameH: 405 }, maskPayload: { encoding: "one_bit" as const, width: 2, height: 2, payload: "xx" } },
        { ordinal: "6", box: { x1: 10, y1: 10, x2: 20, y2: 20, frameW: 720, frameH: 405 }, maskPayload: { encoding: "one_bit" as const, width: 2, height: 2, payload: "xx" } },
      ],
    }];
    expect(selectMaskRecord(calls, noun)?.record.ordinal).toBe("6");
    const unverified = { ...noun, maskOrdinal: undefined, verified: false as const };
    expect(selectMaskRecord([{
      requestId: "req",
      present: true,
      records: [{ ordinal: "0", boxRecovered: true, box: { x1: 1, y1: 1, x2: 4, y2: 4 }, maskPayload: { encoding: "one_bit" as const, width: 2, height: 2, payload: "xx" } }],
    }], unverified)).toBeNull();
    const matched = { ...noun, maskOrdinal: undefined, verified: true as const };
    expect(selectMaskRecord([{
      requestId: "req",
      present: true,
      records: [{ ordinal: "0", boxRecovered: true, box: { x1: 1, y1: 1, x2: 4, y2: 4, frameW: 720, frameH: 405 }, maskPayload: { encoding: "one_bit" as const, width: 2, height: 2, payload: "xx" } }],
    }], matched)?.box).toEqual({ x1: 1, y1: 1, x2: 4, y2: 4, frameW: 720, frameH: 405 });
  });

  it("uses origami paper instance 6 and leaves unverified latte cups blank", () => {
    const origami = SAMPLE_SCENES.find((scene) => scene.demo === "origami");
    const paper = origami!.steps[0].nouns.find((noun) => noun.noun === "paper");
    const paperFile = loadSam("origami", origami!.steps[0].samFile);
    expect(selectMaskRecord(paperFile.calls, paper!)?.record.ordinal).toBe("6");
    const crane = origami!.steps[2].nouns[0];
    const craneFile = loadSam("origami", origami!.steps[2].samFile);
    expect(crane.verified).toBe(false);
    expect(selectMaskRecord(craneFile.calls, crane)).toBeNull();
    const latte = SAMPLE_SCENES.find((scene) => scene.demo === "latte-art");
    for (const index of [0, 2]) {
      const cup = latte!.steps[index].nouns[0];
      const file = loadSam("latte-art", latte!.steps[index].samFile);
      expect(cup.verified).toBe(false);
      expect(selectMaskRecord(file.calls, cup)).toBeNull();
    }
    const verifiedCup = latte!.steps[1].nouns[0];
    const step2 = loadSam("latte-art", latte!.steps[1].samFile);
    expect(selectMaskRecord(step2.calls, verifiedCup)?.box.x1).toBeGreaterThan(200);
  });

  it("does not invent a mask when the sam file is empty", () => {
    const scene = SAMPLE_SCENES[0];
    const noun = scene.steps[0].nouns[0];
    expect(selectMaskRecord([], noun)).toBeNull();
    expect(selectMaskRecord(undefined, noun)).toBeNull();
    expect(selectMaskRecord([{ noun: noun.noun, present: true, records: [] }], noun)).toBeNull();
    expect(selectMaskRecord([{ noun: noun.noun, present: true, records: [{ box: { x1: 1, y1: 1, x2: 4, y2: 4 } }] }], noun)).toBeNull();
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

  it("fills the view in both dimensions at zoom 1", () => {
    const views: Array<[number, number]> = [[280, 224], [360, 288], [390, 312], [390, 844], [500, 400], [1440, 900]];
    for (const [viewW, viewH] of views) {
      const cover = coverTransform(720, 405, viewW, viewH, { x: 0.38, y: 0.5 }, 1);
      expect(cover.width).toBeGreaterThanOrEqual(viewW - 0.01);
      expect(cover.height).toBeGreaterThanOrEqual(viewH - 0.01);
    }
  });

  it("keeps the mortar and pestle inside a 5:4 cover", () => {
    const position = { x: 0.3784, y: 0.5 };
    const viewW = 500;
    const viewH = 400;
    const cover = coverTransform(720, 405, viewW, viewH, position, 1);
    const boxes = [
      { x1: 100, y1: 0, x2: 217, y2: 250 },
      { x1: 221, y1: 85, x2: 568, y2: 380 },
    ];
    for (const box of boxes) {
      for (const [x, y] of [[box.x1, box.y1], [box.x2, box.y1], [box.x1, box.y2], [box.x2, box.y2]] as const) {
        const point = frameToView(x, y, 720, 405, cover);
        expect(point.x).toBeGreaterThanOrEqual(-0.5);
        expect(point.y).toBeGreaterThanOrEqual(-0.5);
        expect(point.x).toBeLessThanOrEqual(viewW + 0.5);
        expect(point.y).toBeLessThanOrEqual(viewH + 0.5);
      }
    }
    const window = visibleFrameRect(720, 405, viewW, viewH, cover);
    expect(window.x1).toBeLessThanOrEqual(100);
    expect(window.x2).toBeGreaterThanOrEqual(568);
  });

  it("clips a contour so every point stays inside the cover window", () => {
    const d = "M 0 10 L 100 10 L 100 80 L 0 80 Z";
    const clipped = clipPathToRect(d, { x1: 20, y1: 0, x2: 70, y2: 100 });
    const nums = clipped.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    expect(nums.length).toBeGreaterThan(4);
    for (let index = 0; index < nums.length; index += 2) {
      expect(nums[index]).toBeGreaterThanOrEqual(20);
      expect(nums[index]).toBeLessThanOrEqual(70);
      expect(nums[index + 1]).toBeGreaterThanOrEqual(0);
      expect(nums[index + 1]).toBeLessThanOrEqual(100);
    }
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
