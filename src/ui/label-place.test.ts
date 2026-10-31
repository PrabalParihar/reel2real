import { describe, expect, it } from "vitest";
import { EDGE_STROKE_INSET } from "./PhotoFrame";
import { chooseLabelPosition, strokeClearance } from "./label-place";

describe("label clearance", () => {
  it("places a chip to the right of a vertical stroke with 4px past the stroke", () => {
    const strokes: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
      [{ x: 40, y: 30 }, { x: 40, y: 150 }],
    ];
    const placed = chooseLabelPosition({
      viewW: 320,
      viewH: 240,
      labelW: 64,
      labelH: 24,
      bounds: { minX: 40, minY: 30, maxX: 40, maxY: 150 },
      strokes,
      strokeRadius: 8,
      clearance: 4,
    });
    expect(placed).not.toBeNull();
    const rect = {
      x1: placed!.x - 32,
      y1: placed!.y - 12,
      x2: placed!.x + 32,
      y2: placed!.y + 12,
    };
    expect(rect.x1).toBeGreaterThanOrEqual(4);
    expect(rect.y1).toBeGreaterThanOrEqual(4);
    expect(rect.x2).toBeLessThanOrEqual(316);
    expect(rect.y2).toBeLessThanOrEqual(236);
    expect(strokeClearance(rect, strokes)).toBeGreaterThanOrEqual(12);
  });

  it("skips a side that would land on a second outline", () => {
    const own: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
      [{ x: 80, y: 40 }, { x: 80, y: 120 }],
    ];
    const other: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
      [{ x: 20, y: 70 }, { x: 200, y: 70 }],
    ];
    const placed = chooseLabelPosition({
      viewW: 280,
      viewH: 200,
      labelW: 60,
      labelH: 22,
      bounds: { minX: 80, minY: 40, maxX: 80, maxY: 120 },
      strokes: [...own, ...other],
      strokeRadius: 4,
      clearance: 4,
    });
    expect(placed).not.toBeNull();
    const rect = {
      x1: placed!.x - 30,
      y1: placed!.y - 11,
      x2: placed!.x + 30,
      y2: placed!.y + 11,
    };
    expect(strokeClearance(rect, [...own, ...other])).toBeGreaterThanOrEqual(8);
  });

  it("slides along a side when the centered spot is blocked", () => {
    const strokes: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
      [{ x: 80, y: 40 }, { x: 80, y: 160 }],
      [{ x: 90, y: 100 }, { x: 200, y: 100 }],
    ];
    const placed = chooseLabelPosition({
      viewW: 240,
      viewH: 200,
      labelW: 50,
      labelH: 20,
      bounds: { minX: 80, minY: 40, maxX: 80, maxY: 160 },
      strokes,
      strokeRadius: 4,
      clearance: 4,
      blocked: [
        { x1: 0, y1: 0, x2: 240, y2: 50 },
        { x1: 0, y1: 150, x2: 240, y2: 200 },
        { x1: 0, y1: 0, x2: 40, y2: 200 },
      ],
    });
    expect(placed).not.toBeNull();
    const rect = {
      x1: placed!.x - 25,
      y1: placed!.y - 10,
      x2: placed!.x + 25,
      y2: placed!.y + 10,
    };
    expect(rect.x1).toBeGreaterThanOrEqual(4);
    expect(rect.y2).toBeLessThanOrEqual(196);
    expect(strokeClearance(rect, strokes)).toBeGreaterThanOrEqual(8);
  });

  it("keeps an edge object's chip inside the frame and clear of the stroke", () => {
    const strokes: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
      [{ x: 700, y: 30 }, { x: 710, y: 370 }],
    ];
    const placed = chooseLabelPosition({
      viewW: 720,
      viewH: 405,
      labelW: 64,
      labelH: 24,
      bounds: { minX: 700, minY: 30, maxX: 710, maxY: 370 },
      strokes,
      strokeRadius: 14,
      clearance: 4,
    });
    expect(placed).not.toBeNull();
    const rect = {
      x1: placed!.x - 32,
      y1: placed!.y - 12,
      x2: placed!.x + 32,
      y2: placed!.y + 12,
    };
    expect(rect.x1).toBeGreaterThanOrEqual(4);
    expect(rect.y1).toBeGreaterThanOrEqual(4);
    expect(rect.x2).toBeLessThanOrEqual(716);
    expect(rect.y2).toBeLessThanOrEqual(401);
    expect(strokeClearance(rect, strokes)).toBeGreaterThanOrEqual(18);
    expect(EDGE_STROKE_INSET).toBe(20);
  });
});
