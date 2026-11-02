import { frameToView, type CoverTransform, type FrameBox, type Point } from "@/src/samples/mask-geometry";

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
  const inward = inwardLabel(input, gap, halfW, halfH);
  return inward;
}

/** Last resort for an outline on the source edge: walk inside the frame until a clear spot exists. */
function inwardLabel(input: LabelPlaceInput, gap: number, halfW: number, halfH: number): Point | null {
  const { minX, minY, maxX, maxY } = input.bounds;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetX = input.viewW / 2;
  const targetY = input.viewH / 2;
  for (let step = 0; step <= 24; step += 1) {
    const t = step / 24;
    const candidate = { x: cx + (targetX - cx) * t, y: cy + (targetY - cy) * t };
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
  return null;
}

const FRAME_PAD = 4;
const LABEL_GAP = 4;
const NUDGE = 8;
/** A label may sit this far from its own mask and still count as next to it. */
export const LABEL_ADJACENT_PX = 12;

function clamp(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

function overlaps(a: LabelRect, b: LabelRect): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function gapBetween(a: LabelRect, b: LabelRect): number {
  const dx = Math.max(b.x1 - a.x2, a.x1 - b.x2, 0);
  const dy = Math.max(b.y1 - a.y2, a.y1 - b.y2, 0);
  return Math.hypot(dx, dy);
}

export function nounLabelSize(noun: string): { w: number; h: number } {
  return { w: noun.length * 7.2 + 22, h: 27 };
}

/**
 * Mask bbox in the same view pixels as the drawn path, after the cover crop.
 * The returned box is the part that is actually on screen.
 */
export function maskBoxInView(
  box: FrameBox,
  frameW: number,
  frameH: number,
  cover: CoverTransform,
  viewW: number,
  viewH: number,
): LabelRect | null {
  const topLeft = frameToView(box.x1, box.y1, frameW, frameH, cover);
  const bottomRight = frameToView(box.x2, box.y2, frameW, frameH, cover);
  const x1 = Math.max(0, Math.min(topLeft.x, bottomRight.x));
  const y1 = Math.max(0, Math.min(topLeft.y, bottomRight.y));
  const x2 = Math.min(viewW, Math.max(topLeft.x, bottomRight.x));
  const y2 = Math.min(viewH, Math.max(topLeft.y, bottomRight.y));
  if (x2 - x1 < 2 || y2 - y1 < 2) return null;
  return { x1, y1, x2, y2 };
}

export interface AnchoredLabel {
  key: string;
  noun: string;
  color: string;
  x: number;
  y: number;
  rect: LabelRect;
  box: LabelRect;
}

interface AnchoredTarget {
  key: string;
  noun: string;
  color: string;
  box: LabelRect;
}

function labelRect(cx: number, cy: number, halfW: number, halfH: number): LabelRect {
  return { x1: cx - halfW, y1: cy - halfH, x2: cx + halfW, y2: cy + halfH };
}

function insideFrame(rect: LabelRect, viewW: number, viewH: number): boolean {
  return rect.x1 >= FRAME_PAD && rect.y1 >= FRAME_PAD && rect.x2 <= viewW - FRAME_PAD && rect.y2 <= viewH - FRAME_PAD;
}

function nudgeOffsets(limit: number): number[] {
  const offsets = [0];
  for (let delta = NUDGE; delta <= limit; delta += NUDGE) offsets.push(delta, -delta);
  return offsets;
}

/**
 * Centre a label on its own mask, on the top edge, then try inside-top, below,
 * left, and right. Nudges stay deterministic. The box is already in view pixels.
 */
export function placeAnchoredLabels(input: {
  viewW: number;
  viewH: number;
  targets: AnchoredTarget[];
  blocked?: LabelRect[];
}): AnchoredLabel[] {
  const placed: AnchoredLabel[] = [];
  const blocked = [...(input.blocked ?? [])];
  for (const target of input.targets) {
    const size = nounLabelSize(target.noun);
    const halfW = size.w / 2;
    const halfH = size.h / 2;
    const box = target.box;
    const cx = (box.x1 + box.x2) / 2;
    const cy = (box.y1 + box.y2) / 2;
    const others = input.targets.filter((item) => item.key !== target.key).map((item) => item.box);
    const families: Array<{ axis: "x" | "y"; x: number; y: number }> = [
      { axis: "x", x: cx, y: box.y1 - LABEL_GAP - halfH },
      { axis: "x", x: cx, y: box.y1 + LABEL_GAP + halfH },
      { axis: "x", x: cx, y: box.y2 + LABEL_GAP + halfH },
      { axis: "y", x: box.x1 - LABEL_GAP - halfW, y: cy },
      { axis: "y", x: box.x2 + LABEL_GAP + halfW, y: cy },
    ];
    const limit = Math.max(input.viewW, input.viewH);
    const offsets = nudgeOffsets(limit);
    let chosen: { x: number; y: number; rect: LabelRect } | null = null;
    const passes = [true, false];
    for (const avoidMasks of passes) {
      if (chosen) break;
      for (const family of families) {
        if (chosen) break;
        for (const offset of offsets) {
          const raw = family.axis === "x"
            ? { x: family.x + offset, y: family.y }
            : { x: family.x, y: family.y + offset };
          const x = clamp(raw.x, FRAME_PAD + halfW, input.viewW - FRAME_PAD - halfW);
          const y = clamp(raw.y, FRAME_PAD + halfH, input.viewH - FRAME_PAD - halfH);
          const rect = labelRect(x, y, halfW, halfH);
          if (!insideFrame(rect, input.viewW, input.viewH)) continue;
          if (gapBetween(rect, box) > LABEL_ADJACENT_PX) continue;
          if (blocked.some((item) => overlaps(rect, item))) continue;
          if (avoidMasks && others.some((item) => overlaps(rect, item))) continue;
          chosen = { x, y, rect };
          break;
        }
      }
    }
    if (!chosen) {
      const x = clamp(cx, FRAME_PAD + halfW, input.viewW - FRAME_PAD - halfW);
      const y = clamp(box.y1 + LABEL_GAP + halfH, FRAME_PAD + halfH, input.viewH - FRAME_PAD - halfH);
      chosen = { x, y, rect: labelRect(x, y, halfW, halfH) };
    }
    blocked.push(chosen.rect);
    placed.push({ key: target.key, noun: target.noun, color: target.color, x: chosen.x, y: chosen.y, rect: chosen.rect, box });
  }
  return placed;
}
