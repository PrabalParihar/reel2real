import { describe, expect, it } from "vitest";
import {
  fitDemo,
  FRAME_MARGIN,
  FRAME_SHAPES,
  placementFor,
  sourceClearance,
  usesSourceEdgeException,
} from "./frame-fit";

const FRAME_H = 405;

describe("source-edge exception", () => {
  it("applies when source clearance is under 4% and no chain crop holds the boxes", () => {
    const wide = [{ x1: 70, y1: 65, x2: 714, y2: 404 }];
    const later = [{ x1: 49, y1: 272, x2: 123, y2: 337 }];
    expect(sourceClearance(wide)).toBeLessThan(FRAME_MARGIN * FRAME_H);
    expect(FRAME_SHAPES.some((shape) => placementFor(wide, shape.aspect))).toBe(false);
    expect(usesSourceEdgeException(wide)).toBe(true);
    const fit = fitDemo([wide, later]);
    expect(fit.steps[0]?.fullFrame).toBe(true);
    expect(fit.steps[0]?.zoom).toBe(1);
    expect(fit.steps[0]?.position).toEqual({ x: 0.5, y: 0.5 });
    expect(fit.steps[1]?.fullFrame).toBeFalsy();
    expect(placementFor(later, FRAME_SHAPES[0].aspect)).not.toBeNull();
    expect(fit.shape).toBe("4:5");
  });

  it("does not apply when a valid crop exists", () => {
    const nearEdge = [{ x1: 0, y1: 100, x2: 180, y2: 280 }];
    expect(sourceClearance(nearEdge)).toBeLessThan(FRAME_MARGIN * FRAME_H);
    expect(placementFor(nearEdge, FRAME_SHAPES[0].aspect)).not.toBeNull();
    expect(usesSourceEdgeException(nearEdge)).toBe(false);
    const fit = fitDemo([nearEdge]);
    expect(fit.steps[0]?.fullFrame).toBeFalsy();
    expect(fit.steps[0]?.zoom).toBe(1);
    expect(fit.shape).toBe("4:5");
  });
});
