import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEMOS } from "@/src/samples/demos";
import { coverTransform, frameToView, visibleFrameRect, type FrameBox } from "@/src/samples/mask-geometry";
import { recordedFrameFile, type SampleScene } from "@/src/samples/scene";

const FRAME = { w: 720, h: 405 };
const IMAGE = { w: 1280, h: 720 };

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
