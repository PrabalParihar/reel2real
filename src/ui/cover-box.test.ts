import { describe, expect, it } from "vitest";
import { coverNormalizedBox } from "./cover-box";

const box = { x: 0.4, y: 0.35, w: 0.2, h: 0.3 };

describe("live box cover transform", () => {
  it("leaves a box unchanged when the stage matches the frame", () => {
    const mapped = coverNormalizedBox(box, 1280, 720, 640, 360);
    expect(mapped.x).toBeCloseTo(box.x, 4);
    expect(mapped.y).toBeCloseTo(box.y, 4);
    expect(mapped.w).toBeCloseTo(box.w, 4);
    expect(mapped.h).toBeCloseTo(box.h, 4);
  });

  it("crops a landscape frame on a portrait stage", () => {
    const frame = { w: 1280, h: 720 };
    const view = { w: 390, h: 844 };
    const mapped = coverNormalizedBox(box, frame.w, frame.h, view.w, view.h);
    const center = mapped.x + mapped.w / 2;
    expect(center).toBeCloseTo(box.x + box.w / 2, 2);
    expect(mapped.w).toBeGreaterThan(box.w);
    const left = coverNormalizedBox({ x: 0.02, y: 0.4, w: 0.08, h: 0.2 }, frame.w, frame.h, view.w, view.h);
    expect(left.x + left.w).toBeLessThan(0);
  });

  it("crops a portrait frame on a landscape stage", () => {
    const frame = { w: 720, h: 1280 };
    const view = { w: 1440, h: 600 };
    const mapped = coverNormalizedBox(box, frame.w, frame.h, view.w, view.h);
    const center = mapped.y + mapped.h / 2;
    expect(center).toBeCloseTo(box.y + box.h / 2, 2);
    expect(mapped.h).toBeGreaterThan(box.h);
    const top = coverNormalizedBox({ x: 0.4, y: 0.02, w: 0.2, h: 0.08 }, frame.w, frame.h, view.w, view.h);
    expect(top.y + top.h).toBeLessThan(0);
  });
});