import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEMOS } from "@/src/samples/demos";
import { coverTransform, frameToView, MASK_FRAME, SAMPLE_STILL, scaleFrameBox, sharedStillRect, visibleFrameRect, type FrameBox } from "@/src/samples/mask-geometry";
import { recordedFrameFile, selectMaskRecord, unverifiedStep, unverifiedStepHint, type SampleScene, type SamStepFile } from "@/src/samples/scene";

const FRAME = { w: MASK_FRAME.width, h: MASK_FRAME.height };
const IMAGE = { w: SAMPLE_STILL.width, h: SAMPLE_STILL.height };

function loadSam(demo: string, file: string): SamStepFile {
  return JSON.parse(readFileSync(`public/samples/${demo}/${file}`, "utf8")) as SamStepFile;
}

function shapeAspect(shape: string): number {
  if (shape === "4:5") return 4 / 5;
  if (shape === "1:1") return 1;
  return 5 / 4;
}

function windowAt(viewW: number, aspect: number, position: { x: number; y: number }, zoom: number): FrameBox {
  const viewH = viewW / aspect;
  const cover = coverTransform(FRAME.w, FRAME.h, viewW, viewH, position, zoom);
  return visibleFrameRect(FRAME.w, FRAME.h, viewW, viewH, cover);
}

function imageBox(box: FrameBox): FrameBox {
  const sx = IMAGE.w / FRAME.w;
  const sy = IMAGE.h / FRAME.h;
  return { x1: box.x1 * sx, y1: box.y1 * sy, x2: box.x2 * sx, y2: box.y2 * sy };
}

describe("recorded mask alignment", () => {
  it("divides 720-space pixels by frameW and frameH, not by the jpg size", () => {
    const frameW = 720;
    const frameH = 405;
    const imageW = 1280;
    const box = { x1: 310, y1: 199, x2: 372, y2: 322 };
    const unitX = box.x1 / frameW;
    const jpgX = unitX * imageW;
    expect(jpgX).toBeCloseTo((310 * 1280) / 720, 5);
    expect(Math.abs(box.x1 - jpgX)).toBeGreaterThan(100);
    const viewW = 1440;
    const viewH = viewW * (frameH / frameW);
    const cover = coverTransform(frameW, frameH, viewW, viewH, { x: 0.5, y: 0.5 }, 1);
    const view = frameToView(box.x1, box.y1, frameW, frameH, cover);
    expect(view.x).toBeCloseTo(unitX * viewW, 4);
    expect(view.x).not.toBeCloseTo((box.x1 / imageW) * viewW, 1);
  });

  it("keeps every mask box inside its SAM frame", () => {
    for (const demo of DEMOS) {
      demo.boxes.forEach((step, index) => {
        for (const box of step) {
          expect(box.x1, `${demo.slug} step ${index + 1}`).toBeGreaterThanOrEqual(0);
          expect(box.y1).toBeGreaterThanOrEqual(0);
          expect(box.x2).toBeLessThanOrEqual(FRAME.w);
          expect(box.y2).toBeLessThanOrEqual(FRAME.h);
          expect(box.x2).toBeGreaterThan(box.x1);
          expect(box.y2).toBeGreaterThan(box.y1);
        }
      });
    }
  });

  it("maps each mask bbox onto the same image region at 1440 and 390", () => {
    for (const demo of DEMOS) {
      demo.boxes.forEach((step, index) => {
        const full = demo.stepFullFrame[index];
        const aspect = full ? FRAME.w / FRAME.h : (demo.shape === "4:5" ? 4 / 5 : demo.shape === "1:1" ? 1 : 5 / 4);
        const position = full ? { x: 0.5, y: 0.5 } : demo.stepCrops[index];
        const zoom = full ? 1 : demo.stepZooms[index];
        const narrow = windowAt(390, aspect, position, zoom);
        const wide = windowAt(1440, aspect, position, zoom);
        expect(narrow.x1).toBeCloseTo(wide.x1, 4);
        expect(narrow.y1).toBeCloseTo(wide.y1, 4);
        expect(narrow.x2).toBeCloseTo(wide.x2, 4);
        expect(narrow.y2).toBeCloseTo(wide.y2, 4);
        for (const box of step) {
          const region = imageBox(box);
          expect(region.x1).toBeGreaterThanOrEqual(-0.5);
          expect(region.y1).toBeGreaterThanOrEqual(-0.5);
          expect(region.x2).toBeLessThanOrEqual(IMAGE.w + 0.5);
          expect(region.y2).toBeLessThanOrEqual(IMAGE.h + 0.5);
          const viewNarrow = frameToView(box.x1, box.y1, FRAME.w, FRAME.h, coverTransform(FRAME.w, FRAME.h, 390, 390 / aspect, position, zoom));
          const viewWide = frameToView(box.x1, box.y1, FRAME.w, FRAME.h, coverTransform(FRAME.w, FRAME.h, 1440, 1440 / aspect, position, zoom));
          expect(viewNarrow.x / 390).toBeCloseTo(viewWide.x / 1440, 4);
          expect(viewNarrow.y / (390 / aspect)).toBeCloseTo(viewWide.y / (1440 / aspect), 4);
        }
      });
      if (demo.cardOutlines) {
        const cardAspect = 4 / 5;
        const cardNarrow = windowAt(390, cardAspect, demo.cardCrop, demo.cardZoom);
        const cardWide = windowAt(1440, cardAspect, demo.cardCrop, demo.cardZoom);
        expect(cardNarrow.x1).toBeCloseTo(cardWide.x1, 4);
        expect(cardNarrow.y1).toBeCloseTo(cardWide.y1, 4);
        expect(cardNarrow.x2).toBeCloseTo(cardWide.x2, 4);
        expect(cardNarrow.y2).toBeCloseTo(cardWide.y2, 4);
      }
    }
  });

  it("scales every overlay to the still, then applies the fitDemo crop", () => {
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    const frame = readFileSync("src/ui/PhotoFrame.tsx", "utf8");
    expect(frame).toContain("scaleFrameBox");
    expect(frame).toContain("SAMPLE_STILL");
    expect(coach).toContain("unverifiedStepHint");
    expect(coach).toContain("recordedSampleStatus(recordedRun && showRecorded, noVerifiedMask)");
    expect(coach).toContain(": noVerifiedMask\n      ? null");
    expect(coach).toContain("sampleChip={!noVerifiedMask}");
    for (const demo of DEMOS) {
      demo.scene.steps.forEach((step, index) => {
        const file = loadSam(demo.slug, step.samFile);
        const unverified = unverifiedStep(step.nouns);
        const drawn = step.nouns.flatMap((noun) => {
          const selected = selectMaskRecord(file.calls, noun);
          return selected ? [selected] : [];
        });
        if (unverified) {
          expect(drawn, `${demo.slug} step ${index + 1}`).toEqual([]);
          expect(demo.boxes[index]).toEqual([]);
          return;
        }
        expect(drawn.length, `${demo.slug} step ${index + 1}`).toBeGreaterThan(0);
        if (demo.slug === "origami" && index === 0) {
          const paper = drawn.find((item) => item.call.noun === "paper");
          expect(paper?.record.ordinal).toBe("6");
        }
        const full = demo.stepFullFrame[index] === true;
        const aspect = full ? IMAGE.w / IMAGE.h : shapeAspect(demo.shape);
        const position = full ? { x: 0.5, y: 0.5 } : demo.stepCrops[index];
        const zoom = full ? 1 : demo.stepZooms[index];
        const views = [390, 1440].map((viewW) => {
          const viewH = viewW / aspect;
          const cover = coverTransform(IMAGE.w, IMAGE.h, viewW, viewH, position, zoom);
          return { viewW, viewH, cover, visible: visibleFrameRect(IMAGE.w, IMAGE.h, viewW, viewH, cover) };
        });
        if (full) {
          expect(views[1].visible.x1).toBeCloseTo(0, 1);
          expect(views[1].visible.y1).toBeCloseTo(0, 1);
          expect(views[1].visible.x2).toBeCloseTo(IMAGE.w, 1);
          expect(views[1].visible.y2).toBeCloseTo(IMAGE.h, 1);
        }
        for (const selected of drawn) {
          const image = scaleFrameBox(selected.box, selected.box.frameW, selected.box.frameH);
          expect(image.x1).toBeCloseTo(selected.box.x1 * (IMAGE.w / FRAME.w), 4);
          expect(image.y1).toBeCloseTo(selected.box.y1 * (IMAGE.h / FRAME.h), 4);
          const rawOnStill = frameToView(selected.box.x1, selected.box.y1, IMAGE.w, IMAGE.h, views[1].cover);
          const scaled = frameToView(image.x1, image.y1, IMAGE.w, IMAGE.h, views[1].cover);
          expect(Math.abs(scaled.x - rawOnStill.x)).toBeGreaterThan(1);
          views.forEach((view) => {
            expect(image.x1, `${demo.slug} step ${index + 1}`).toBeGreaterThanOrEqual(view.visible.x1 - 1);
            expect(image.y1).toBeGreaterThanOrEqual(view.visible.y1 - 1);
            expect(image.x2).toBeLessThanOrEqual(view.visible.x2 + 1);
            expect(image.y2).toBeLessThanOrEqual(view.visible.y2 + 1);
          });
          const narrow = frameToView(image.x1, image.y1, IMAGE.w, IMAGE.h, views[0].cover);
          const wide = frameToView(image.x1, image.y1, IMAGE.w, IMAGE.h, views[1].cover);
          expect(narrow.x / views[0].viewW).toBeCloseTo(wide.x / views[1].viewW, 4);
          expect(narrow.y / views[0].viewH).toBeCloseTo(wide.y / views[1].viewH, 4);
        }
      });
      if (demo.slug === "latte-art") {
        expect(demo.cardOutlines).toBe(true);
        expect(demo.scene.hero.samStep).toBe(2);
        const step = demo.scene.steps[1];
        const file = loadSam(demo.slug, step.samFile);
        const cup = selectMaskRecord(file.calls, step.nouns[0]);
        expect(cup).not.toBeNull();
        const image = scaleFrameBox(cup!.box, cup!.box.frameW, cup!.box.frameH);
        for (const viewW of [390, 1440]) {
          const viewH = viewW / (4 / 5);
          const cover = coverTransform(IMAGE.w, IMAGE.h, viewW, viewH, demo.cardCrop, demo.cardZoom);
          const visible = visibleFrameRect(IMAGE.w, IMAGE.h, viewW, viewH, cover);
          expect(image.x1).toBeGreaterThanOrEqual(visible.x1 - 1);
          expect(image.y1).toBeGreaterThanOrEqual(visible.y1 - 1);
          expect(image.x2).toBeLessThanOrEqual(visible.x2 + 1);
          expect(image.y2).toBeLessThanOrEqual(visible.y2 + 1);
          const point = frameToView(image.x1, image.y1, IMAGE.w, IMAGE.h, cover);
          expect(point.x).toBeGreaterThanOrEqual(-1);
          expect(point.x).toBeLessThanOrEqual(viewW + 1);
          expect(point.y).toBeGreaterThanOrEqual(-1);
          expect(point.y).toBeLessThanOrEqual(viewH + 1);
        }
        for (const index of [0, 2]) {
          expect(unverifiedStep(demo.scene.steps[index].nouns)).toBe(true);
          expect(demo.boxes[index]).toEqual([]);
        }
        const hint = unverifiedStepHint(demo.scene.steps[0].nouns);
        expect(hint).toBe("Keep the cup fully in frame");
        expect(hint.toLowerCase()).not.toContain("sample");
        expect(hint.toLowerCase()).not.toContain("highlight");
        expect(unverifiedStepHint(DEMOS.find((item) => item.slug === "origami")!.scene.steps[2].nouns)).toBe("Keep the crane fully in frame");
      }
    }
  });

  it("puts the still and the outline on one rect at the natural image fraction", () => {
    const frame = readFileSync("src/ui/PhotoFrame.tsx", "utf8");
    expect(frame).toContain("sharedStillRect");
    expect(frame).toContain("<image");
    expect(frame).not.toContain("next/image");
    for (const demo of DEMOS) {
      demo.scene.steps.forEach((step, index) => {
        const file = loadSam(demo.slug, step.samFile);
        const full = demo.stepFullFrame[index] === true;
        const aspect = full ? IMAGE.w / IMAGE.h : shapeAspect(demo.shape);
        const position = full ? { x: 0.5, y: 0.5 } : demo.stepCrops[index];
        const zoom = full ? 1 : demo.stepZooms[index];
        for (const noun of step.nouns) {
          const selected = selectMaskRecord(file.calls, noun);
          if (!selected) {
            expect(noun.verified === true && noun.present).toBe(false);
            continue;
          }
          expect(noun.verified).toBe(true);
          const image = scaleFrameBox(selected.box, selected.box.frameW, selected.box.frameH);
          for (const viewW of [390, 1440]) {
            const viewH = viewW / aspect;
            const cover = sharedStillRect(viewW, viewH, position, zoom);
            const stillBox = { x: cover.left, y: cover.top, width: cover.width, height: cover.height };
            const point = frameToView(image.x1, image.y1, IMAGE.w, IMAGE.h, cover);
            expect((point.x - stillBox.x) / stillBox.width).toBeCloseTo(image.x1 / IMAGE.w, 5);
            expect((point.y - stillBox.y) / stillBox.height).toBeCloseTo(image.y1 / IMAGE.h, 5);
            const wrong = frameToView(selected.box.x1, selected.box.y1, IMAGE.w, IMAGE.h, cover);
            expect(Math.abs(point.x - wrong.x)).toBeGreaterThan(1);
          }
        }
      });
    }
  });

  it("uses the step still whenever outlines render", () => {
    for (const demo of DEMOS) {
      demo.scene.steps.forEach((step, index) => {
        expect(recordedFrameFile(demo.scene as SampleScene, index)).toBe(step.keyframe);
      });
    }
    const landing = readFileSync("src/ui/Landing.tsx", "utf8");
    const coach = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    expect(landing).toContain("sample.cardOutlines ? recordedFrameFile");
    expect(landing).toContain("loopSrc={sample.cardOutlines ? undefined");
    expect(coach).toContain("recordedFrameFile(scene, stepIndex)");
    expect(coach).not.toContain("loopSrc=");
  });
});
