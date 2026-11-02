import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS } from "@/src/samples/demos";
import { SAMPLE_STILL, scaleFrameBox, sharedStillRect } from "@/src/samples/mask-geometry";
import { selectMaskRecord, type SamStepFile } from "@/src/samples/scene";
import { readableChipColor } from "./chip-color";
import { LABEL_ADJACENT_PX, maskBoxInView, placeAnchoredLabels, type LabelRect } from "./label-place";

function overlaps(a: LabelRect, b: LabelRect): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function gapBetween(a: LabelRect, b: LabelRect): number {
  const dx = Math.max(b.x1 - a.x2, a.x1 - b.x2, 0);
  const dy = Math.max(b.y1 - a.y2, a.y1 - b.y2, 0);
  return Math.hypot(dx, dy);
}

function seedStep1(viewW: number, viewH: number) {
  const demo = DEMOS.find((item) => item.slug === "seed-planting");
  if (!demo) throw new Error("seed");
  const step = demo.scene.steps[0];
  const file = JSON.parse(readFileSync(`public/samples/seed-planting/${step.samFile}`, "utf8")) as SamStepFile;
  const cover = sharedStillRect(viewW, viewH, demo.stepCrops[0], demo.stepZooms[0]);
  const targets = step.nouns.flatMap((noun) => {
    if (noun.verified !== true) return [];
    const selected = selectMaskRecord(file.calls, noun);
    if (!selected) return [];
    const still = scaleFrameBox(selected.box);
    const box = maskBoxInView(still, SAMPLE_STILL.width, SAMPLE_STILL.height, cover, viewW, viewH);
    if (!box) return [];
    return [{
      key: noun.objectId,
      noun: noun.noun,
      color: readableChipColor(noun.color),
      source: noun.color,
      box,
    }];
  });
  const placed = placeAnchoredLabels({ viewW, viewH, targets });
  return { placed, targets };
}

describe("anchored mask labels", () => {
  it("keeps each label on its own box, clear of the others, and inside the frame", () => {
    const placed = placeAnchoredLabels({
      viewW: 400,
      viewH: 300,
      targets: [
        { key: "left", noun: "gloves", color: "#e88c30", box: { x1: 40, y1: 80, x2: 140, y2: 180 } },
        { key: "right", noun: "gloves", color: "#e0559b", box: { x1: 220, y1: 70, x2: 340, y2: 170 } },
        { key: "tray", noun: "tray", color: "#2db4aa", box: { x1: 30, y1: 160, x2: 370, y2: 280 } },
      ],
    });
    expect(placed).toHaveLength(3);
    for (const label of placed) {
      expect(label.rect.x1).toBeGreaterThanOrEqual(0);
      expect(label.rect.y1).toBeGreaterThanOrEqual(0);
      expect(label.rect.x2).toBeLessThanOrEqual(400);
      expect(label.rect.y2).toBeLessThanOrEqual(300);
      expect(gapBetween(label.rect, label.box)).toBeLessThanOrEqual(LABEL_ADJACENT_PX);
    }
    for (let index = 0; index < placed.length; index += 1) {
      for (let other = index + 1; other < placed.length; other += 1) {
        expect(overlaps(placed[index].rect, placed[other].rect)).toBe(false);
      }
    }
  });

  it("holds seed step 1 at the 390 and 1440 cover crops", () => {
    for (const viewW of [390, 1440]) {
      const viewH = viewW * 4 / 5;
      const { placed, targets } = seedStep1(viewW, viewH);
      expect(placed.map((label) => label.key).sort()).toEqual(targets.map((target) => target.key).sort());
      for (const label of placed) {
        expect(label.rect.x1).toBeGreaterThanOrEqual(0);
        expect(label.rect.y1).toBeGreaterThanOrEqual(0);
        expect(label.rect.x2).toBeLessThanOrEqual(viewW);
        expect(label.rect.y2).toBeLessThanOrEqual(viewH);
        expect(gapBetween(label.rect, label.box)).toBeLessThanOrEqual(LABEL_ADJACENT_PX);
        const source = targets.find((target) => target.key === label.key);
        expect(label.color).toBe(source?.color);
      }
      for (let index = 0; index < placed.length; index += 1) {
        for (let other = index + 1; other < placed.length; other += 1) {
          expect(overlaps(placed[index].rect, placed[other].rect), `${viewW} ${placed[index].key} ${placed[other].key}`).toBe(false);
        }
      }
    }
  });

  it("paints the second glove in its own readable colour", () => {
    const demo = DEMOS.find((item) => item.slug === "seed-planting");
    for (const step of demo!.scene.steps) {
      const first = step.nouns.find((noun) => noun.objectId === "obj_gloves");
      const second = step.nouns.find((noun) => noun.objectId === "obj_gloves_1");
      const tray = step.nouns.find((noun) => noun.noun === "tray");
      expect(second?.color.toLowerCase()).toBe("#ff6ba8");
      expect(second?.color.toLowerCase()).not.toBe(first?.color.toLowerCase());
      expect(second?.color.toLowerCase()).not.toBe(tray?.color.toLowerCase());
      expect(readableChipColor(second!.color).toLowerCase()).toBe(second!.color.toLowerCase());
      expect(readableChipColor(first!.color).toLowerCase()).toBe(first!.color.toLowerCase());
    }
    const { placed, targets } = seedStep1(390, 312);
    for (const label of placed) {
      const source = targets.find((target) => target.key === label.key);
      expect(label.color.toLowerCase()).toBe(readableChipColor(source!.source).toLowerCase());
    }
  });
});
