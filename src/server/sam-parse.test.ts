import { describe, expect, it } from "vitest";
import { parseSamBoxes } from "./sam-parse";

describe("SAM box parser", () => {
  it("normalizes the documented box token", () => {
    const text = "<0f>0<|box;x1=100;y1=50;x2=300;y2=250;w=1000;h=500|><|mask;x=0;y=0;data=1,~|>";
    const boxes = parseSamBoxes(text);
    expect(boxes).toHaveLength(1);
    expect(boxes[0].box).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.4 });
  });

  it("does not invent a rect when the token has no geometry", () => {
    expect(parseSamBoxes("<|mask;x=0;y=0;data=1,~|>")[0].box).toBeUndefined();
  });
});