import { decodeMaskToRaster } from "@meta-sam/parser";
import type { SamMaskPayload } from "./scene";

export interface Point {
  x: number;
  y: number;
}

export interface FrameBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface CoverTransform {
  scale: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MaskDraw {
  d: string;
  centroid: Point | null;
}

export interface ObjectPosition {
  x: number;
  y: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/**
 * object-fit: cover plus object-position.
 * Position is 0–1, matching CSS: 0 shows the start edge, 1 the end edge, 0.5 the center.
 */
export function coverTransform(
  frameW: number,
  frameH: number,
  viewW: number,
  viewH: number,
  position: ObjectPosition = { x: 0.5, y: 0.5 },
  zoom = 1,
): CoverTransform {
  if (frameW <= 0 || frameH <= 0 || viewW <= 0 || viewH <= 0) {
    return { scale: 1, left: 0, top: 0, width: Math.max(viewW, 0), height: Math.max(viewH, 0) };
  }
  const fit = Math.max(viewW / frameW, viewH / frameH);
  const scale = fit * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
  let width = frameW * scale;
  let height = frameH * scale;
  if (width + 1 >= viewW) width = Math.max(width, viewW);
  if (height + 1 >= viewH) height = Math.max(height, viewH);
  return {
    scale,
    width,
    height,
    left: (viewW - width) * clamp01(position.x),
    top: (viewH - height) * clamp01(position.y),
  };
}

/** object-position that places a frame point at the center of a cover crop, when the crop allows it. */
export function objectPositionForPoint(
  focalX: number,
  focalY: number,
  frameW: number,
  frameH: number,
  viewW: number,
  viewH: number,
): ObjectPosition {
  const scale = Math.max(viewW / frameW, viewH / frameH);
  const axis = (view: number, scaled: number, frame: number, focal: number) => {
    const spare = view - scaled;
    if (Math.abs(spare) < 0.5 || frame <= 0) return 0.5;
    return clamp01((view / 2 - (focal / frame) * scaled) / spare);
  };
  return {
    x: axis(viewW, frameW * scale, frameW, focalX),
    y: axis(viewH, frameH * scale, frameH, focalY),
  };
}

export function frameToView(x: number, y: number, frameW: number, frameH: number, cover: CoverTransform): Point {
  return {
    x: cover.left + (frameW === 0 ? 0 : (x / frameW) * cover.width),
    y: cover.top + (frameH === 0 ? 0 : (y / frameH) * cover.height),
  };
}

/** Source rectangle that object-fit: cover actually shows inside the view. */
export function visibleFrameRect(
  frameW: number,
  frameH: number,
  viewW: number,
  viewH: number,
  cover: CoverTransform,
): FrameBox {
  const xAt = (viewX: number) => (cover.width === 0 ? 0 : ((viewX - cover.left) / cover.width) * frameW);
  const yAt = (viewY: number) => (cover.height === 0 ? 0 : ((viewY - cover.top) / cover.height) * frameH);
  return { x1: xAt(0), y1: yAt(0), x2: xAt(viewW), y2: yAt(viewH) };
}

function parseSubpaths(d: string): Point[][] {
  const tokens = d.match(/[MLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  if (!tokens) return [];
  const paths: Point[][] = [];
  let current: Point[] | null = null;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "M" || token === "L") {
      const x = Number(tokens[index + 1]);
      const y = Number(tokens[index + 2]);
      index += 2;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!current) current = [];
      current.push({ x, y });
    } else if (token === "Z" || token === "z") {
      if (current && current.length >= 3) paths.push(current);
      current = null;
    }
  }
  if (current && current.length >= 3) paths.push(current);
  return paths;
}

function clipEdge(points: Point[], inside: (point: Point) => boolean, cross: (a: Point, b: Point) => Point): Point[] {
  if (!points.length) return [];
  const out: Point[] = [];
  let prev = points[points.length - 1];
  let prevIn = inside(prev);
  for (const curr of points) {
    const currIn = inside(curr);
    if (currIn) {
      if (!prevIn) out.push(cross(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(cross(prev, curr));
    }
    prev = curr;
    prevIn = currIn;
  }
  return out;
}

function lerpEdge(a: Point, b: Point, axis: "x" | "y", at: number): Point {
  const delta = b[axis] - a[axis];
  const t = delta === 0 ? 0 : (at - a[axis]) / delta;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Keep contour vertices inside the visible cover window so they cannot run past the frame. */
export function clipPathToRect(d: string, rect: FrameBox): string {
  if (!(rect.x2 > rect.x1) || !(rect.y2 > rect.y1)) return "";
  const loops = parseSubpaths(d).map((loop) => {
    let points = loop;
    points = clipEdge(points, (point) => point.x >= rect.x1, (a, b) => lerpEdge(a, b, "x", rect.x1));
    points = clipEdge(points, (point) => point.x <= rect.x2, (a, b) => lerpEdge(a, b, "x", rect.x2));
    points = clipEdge(points, (point) => point.y >= rect.y1, (a, b) => lerpEdge(a, b, "y", rect.y1));
    points = clipEdge(points, (point) => point.y <= rect.y2, (a, b) => lerpEdge(a, b, "y", rect.y2));
    return points;
  }).filter((loop) => loop.length >= 3);
  return loops.map(loopToPath).filter(Boolean).join(" ");
}

export function smoothMask(raster: Uint8Array, width: number, height: number, radius = 3, cutoff = 0.5): Uint8Array {
  if (radius <= 0) return raster;
  const blurred = boxBlur(raster, width, height, radius);
  const out = new Uint8Array(raster.length);
  for (let index = 0; index < blurred.length; index += 1) out[index] = blurred[index] >= cutoff ? 1 : 0;
  return out;
}

function boxBlur(src: Uint8Array, width: number, height: number, radius: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          sum += src[yy * width + xx];
          count += 1;
        }
      }
      out[y * width + x] = count ? sum / count : 0;
    }
  }
  return out;
}

function onPixel(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
}

/** Marching squares on a binary raster. Coordinates sit on the pixel grid. */
export function contourLoops(mask: Uint8Array, width: number, height: number): Point[][] {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let y = 0; y <= height; y += 1) {
    for (let x = 0; x <= width; x += 1) {
      const tl = onPixel(mask, width, height, x - 1, y - 1);
      const tr = onPixel(mask, width, height, x, y - 1);
      const bl = onPixel(mask, width, height, x - 1, y);
      const br = onPixel(mask, width, height, x, y);
      const index = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      const top = { x: x - 0.5, y: y - 1 };
      const bottom = { x: x - 0.5, y };
      const left = { x: x - 1, y: y - 0.5 };
      const right = { x, y: y - 0.5 };
      const add = (a: Point, b: Point) => segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      switch (index) {
        case 1:
        case 14:
          add(left, bottom);
          break;
        case 2:
        case 13:
          add(bottom, right);
          break;
        case 3:
        case 12:
          add(left, right);
          break;
        case 4:
        case 11:
          add(top, right);
          break;
        case 5:
          add(left, top);
          add(bottom, right);
          break;
        case 6:
        case 9:
          add(top, bottom);
          break;
        case 7:
        case 8:
          add(left, top);
          break;
        case 10:
          add(top, right);
          add(left, bottom);
          break;
        default:
          break;
      }
    }
  }
  return connectSegments(segments);
}

function connectSegments(segments: Array<{ x1: number; y1: number; x2: number; y2: number }>): Point[][] {
  const keyOf = (x: number, y: number) => `${x},${y}`;
  const adjacency = new Map<string, Point[]>();
  const push = (x: number, y: number, next: Point) => {
    const key = keyOf(x, y);
    const list = adjacency.get(key);
    if (list) list.push(next);
    else adjacency.set(key, [next]);
  };
  for (const segment of segments) {
    push(segment.x1, segment.y1, { x: segment.x2, y: segment.y2 });
    push(segment.x2, segment.y2, { x: segment.x1, y: segment.y1 });
  }
  const paths: Point[][] = [];
  for (const [startKey] of adjacency) {
    const neighbors = adjacency.get(startKey);
    if (!neighbors?.length) continue;
    const [sx, sy] = startKey.split(",").map(Number);
    let current = { x: sx, y: sy };
    let prevKey: string | null = null;
    const path: Point[] = [];
    while (true) {
      const currentKey = keyOf(current.x, current.y);
      path.push(current);
      const currentNeighbors = adjacency.get(currentKey);
      if (!currentNeighbors?.length) break;
      const next = currentNeighbors.find((neighbor) => keyOf(neighbor.x, neighbor.y) !== prevKey);
      if (!next) break;
      const nextKey = keyOf(next.x, next.y);
      const left = currentNeighbors.filter((neighbor) => keyOf(neighbor.x, neighbor.y) !== nextKey);
      if (left.length) adjacency.set(currentKey, left);
      else adjacency.delete(currentKey);
      const nextNeighbors = adjacency.get(nextKey);
      if (nextNeighbors) {
        const trimmed = nextNeighbors.filter((neighbor) => keyOf(neighbor.x, neighbor.y) !== currentKey);
        if (trimmed.length) adjacency.set(nextKey, trimmed);
        else adjacency.delete(nextKey);
      }
      if (nextKey === startKey) break;
      prevKey = currentKey;
      current = next;
    }
    if (path.length >= 3) paths.push(path);
  }
  return paths;
}

function dropColinear(points: Point[]): Point[] {
  if (points.length < 4) return points;
  const kept: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const prev = points[(index - 1 + points.length) % points.length];
    const curr = points[index];
    const next = points[(index + 1) % points.length];
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) > 0.001) kept.push(curr);
  }
  return kept.length >= 3 ? kept : points;
}

function chaikin(points: Point[], iterations: number): Point[] {
  let current = points;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next: Point[] = [];
    for (let index = 0; index < current.length; index += 1) {
      const a = current[index];
      const b = current[(index + 1) % current.length];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    current = next;
  }
  return current;
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function shoelace(points: Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area) / 2;
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let max = 0;
  let index = 0;
  const last = points.length - 1;
  for (let cursor = 1; cursor < last; cursor += 1) {
    const distance = perpendicularDistance(points[cursor], points[0], points[last]);
    if (distance > max) {
      max = distance;
      index = cursor;
    }
  }
  if (max <= epsilon) return [points[0], points[last]];
  const left = rdp(points.slice(0, index + 1), epsilon);
  const right = rdp(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

function simplifyClosed(points: Point[], epsilon: number): Point[] {
  if (points.length < 8) return points;
  const open = rdp([...points, points[0]], epsilon);
  if (open.length) open.pop();
  return open.length >= 3 ? open : points;
}

function loopToPath(points: Point[]): string {
  if (points.length < 3) return "";
  const [first, ...rest] = points;
  return [`M ${round(first.x)} ${round(first.y)}`, ...rest.map((point) => `L ${round(point.x)} ${round(point.y)}`), "Z"].join(" ");
}

export function centroidOf(mask: Uint8Array, width: number, height: number): Point | null {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      sumX += x + 0.5;
      sumY += y + 0.5;
      count += 1;
    }
  }
  if (!count) return null;
  return { x: sumX / count, y: sumY / count };
}

function rasterToFrame(point: Point, width: number, height: number, box: FrameBox): Point {
  return {
    x: box.x1 + (point.x / width) * (box.x2 - box.x1),
    y: box.y1 + (point.y / height) * (box.y2 - box.y1),
  };
}

/** Smooth a 0/1 raster, trace it, and place the path inside the SAM box on the native frame. */
export function framePathFromRaster(raster: Uint8Array, width: number, height: number, box: FrameBox, smooth = true): MaskDraw {
  const mask = smooth ? smoothMask(raster, width, height) : raster;
  const loops = contourLoops(mask, width, height)
    .filter((loop) => shoelace(loop) >= 48)
    .map((loop) => chaikin(simplifyClosed(dropColinear(loop), 2.4), 2))
    .map((loop) => loop.map((point) => rasterToFrame(point, width, height, box)));
  const rawCentroid = centroidOf(mask, width, height);
  return {
    d: loops.map(loopToPath).filter(Boolean).join(" "),
    centroid: rawCentroid ? rasterToFrame(rawCentroid, width, height, box) : null,
  };
}

export function framePathFromPayload(mask: SamMaskPayload, box: FrameBox): MaskDraw {
  const raster = decodeMaskToRaster({
    encoding: mask.encoding,
    width: mask.width,
    height: mask.height,
    payload: mask.payload,
  });
  return framePathFromRaster(raster, mask.width, mask.height, box, true);
}
