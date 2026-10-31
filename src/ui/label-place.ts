import type { Point } from "@/src/samples/mask-geometry";

export const LABEL_CLEARANCE = 4;

export interface LabelRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LabelBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Distance from a point to an axis-aligned box. Zero when the point is inside. */
export function pointRectDistance(point: Point, rect: LabelRect): number {
  const dx = Math.max(rect.x1 - point.x, 0, point.x - rect.x2);
  const dy = Math.max(rect.y1 - point.y, 0, point.y - rect.y2);
  return Math.hypot(dx, dy);
}

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const ab = side(a, b, c) * side(a, b, d);
  const cd = side(c, d, a) * side(c, d, b);
  return ab < 0 && cd < 0;
}

/** Smallest distance from a segment to a box. Zero when the segment touches the box. */
export function segmentRectDistance(start: Point, end: Point, rect: LabelRect): number {
  if (pointRectDistance(start, rect) === 0 || pointRectDistance(end, rect) === 0) return 0;
  const corners = [
    { x: rect.x1, y: rect.y1 },
    { x: rect.x2, y: rect.y1 },
    { x: rect.x2, y: rect.y2 },
    { x: rect.x1, y: rect.y2 },
  ];
  const edges: Array<[Point, Point]> = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  if (edges.some(([a, b]) => crosses(start, end, a, b))) return 0;
  let nearest = Math.min(pointRectDistance(start, rect), pointRectDistance(end, rect));
  for (const corner of corners) nearest = Math.min(nearest, pointSegmentDistance(corner, start, end));
  return nearest;
}

export function strokeClearance(rect: LabelRect, strokes: Array<[Point, Point]>): number {
  if (!strokes.length) return Number.POSITIVE_INFINITY;
  return strokes.reduce((nearest, [start, end]) => Math.min(nearest, segmentRectDistance(start, end, rect)), Number.POSITIVE_INFINITY);
}

function intersects(a: LabelRect, b: LabelRect): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

export interface LabelPlaceInput {
  viewW: number;
  viewH: number;
  labelW: number;
  labelH: number;
  bounds: LabelBounds;
  strokes: Array<[Point, Point]>;
  /** How far the painted stroke extends past the path, in view pixels. */
  strokeRadius: number;
  clearance?: number;
  blocked?: LabelRect[];
}

/**
 * Try above, below, left, then right. A side is centered first, then slid
 * along the outline, then stepped outward. The first spot that stays inside
 * the frame, off the status chip, and at least `clearance` past every stroke wins.
 */
export function chooseLabelPosition(input: LabelPlaceInput): Point | null {
  const clearance = input.clearance ?? LABEL_CLEARANCE;
  const gap = input.strokeRadius + clearance;
  const halfW = input.labelW / 2;
  const halfH = input.labelH / 2;
  const { minX, minY, maxX, maxY } = input.bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const shifts = [0];
  const span = Math.max(input.viewW, input.viewH);
  for (let delta = 16; delta < span; delta += 16) shifts.push(delta, -delta);
  for (const extra of [0, 14, 28, 44, 64, 88]) {
    const sides: Array<{ x: number; y: number; axis: "x" | "y" }> = [
      { x: cx, y: minY - gap - halfH - extra, axis: "x" },
      { x: cx, y: maxY + gap + halfH + extra, axis: "x" },
      { x: minX - gap - halfW - extra, y: cy, axis: "y" },
      { x: maxX + gap + halfW + extra, y: cy, axis: "y" },
    ];
    for (const side of sides) {
      for (const shift of shifts) {
        const candidate = side.axis === "x"
          ? { x: side.x + shift, y: side.y }
          : { x: side.x, y: side.y + shift };
        const rect = {
          x1: candidate.x - halfW,
          y1: candidate.y - halfH,
          x2: candidate.x + halfW,
          y2: candidate.y + halfH,
        };
        if (rect.x1 < 4 || rect.y1 < 4 || rect.x2 > input.viewW - 4 || rect.y2 > input.viewH - 4) continue;
        if (strokeClearance(rect, input.strokes) < gap - 0.01) continue;
        if ((input.blocked ?? []).some((block) => intersects(rect, block))) continue;
        return candidate;
      }
    }
  }
  return null;
}
