import { coverTransform, visibleFrameRect, type FrameBox, type ObjectPosition } from "./mask-geometry";

/** Narrowest first. A demo takes the first shape whose cover holds every step. */
export const FRAME_SHAPES = [
  { id: "4:5", aspect: 4 / 5 },
  { id: "1:1", aspect: 1 },
  { id: "5:4", aspect: 5 / 4 },
] as const;

export type FrameShapeId = (typeof FRAME_SHAPES)[number]["id"];

/**
 * Breathing room on every side of a highlighted box, as a fraction of the
 * mask frame height. 4% of 405px is 16.2px. That is 4% of the view height
 * when the cover shows the full frame height, which every shape in the chain
 * does, because each is narrower than 16:9.
 */
export const FRAME_MARGIN = 0.04;

export const CARD_SHAPE: FrameShapeId = "4:5";

export interface StepCrop {
  position: ObjectPosition;
  zoom: number;
  /** Whole source frame at zoom 1. Set only by the source-edge exception. */
  fullFrame?: boolean;
}

export interface DemoFrameFit {
  shape: FrameShapeId;
  aspect: number;
  /** Step index whose boxes need the widest cover. */
  forcedByStep: number;
  steps: StepCrop[];
  /** Glass title sits on the stage only when it misses every highlighted box. */
  stepTitle: Array<"overlay" | "below">;
  card: StepCrop & { outlines: boolean };
}

/** Sample stages use the demo shape at every width. 390 chai is 390 by 312. */
export function sampleStageSize(shape: FrameShapeId, width: number): { width: number; height: number; aspect: number } {
  const aspect = FRAME_SHAPES.find((item) => item.id === shape)?.aspect ?? 1;
  return { width, height: width / aspect, aspect };
}

/** Bottom band reserved for a glass title. Outlines that enter it push the title below the stage. */
export const TITLE_BAND = 0.28;

export function titlePlacementFor(
  boxes: FrameBox[],
  viewW: number,
  viewH: number,
  position: ObjectPosition,
  zoom = 1,
  frameW = 720,
  frameH = 405,
): "overlay" | "below" {
  if (!boxes.length || viewW <= 0 || viewH <= 0) return "overlay";
  const cover = coverTransform(frameW, frameH, viewW, viewH, position, zoom);
  const window = visibleFrameRect(frameW, frameH, viewW, viewH, cover);
  const band = window.y1 + (window.y2 - window.y1) * (1 - TITLE_BAND);
  return boxes.some((box) => box.y2 > band + 0.5) ? "below" : "overlay";
}

function marginPx(frameH: number): number {
  return FRAME_MARGIN * frameH;
}

function visibleSize(frameW: number, frameH: number, aspect: number, zoom: number): { visW: number; visH: number } {
  const viewH = frameH;
  const viewW = frameH * aspect;
  const scale = Math.max(viewW / frameW, viewH / frameH) * zoom;
  return { visW: viewW / scale, visH: viewH / scale };
}

/**
 * Window origin along one axis. Returns null when the boxes cannot sit inside
 * the visible span with the margin. A box that already touches the source
 * frame is allowed to meet the crop edge there, because there is no more image
 * beyond the frame.
 */
function axisOrigin(
  minEdge: number,
  maxEdge: number,
  visible: number,
  source: number,
  pad: number,
): number | null {
  const maxOrigin = Math.max(0, source - visible);
  let lo = 0;
  let hi = maxOrigin;
  if (minEdge - pad >= -0.01) hi = Math.min(hi, minEdge - pad);
  else hi = Math.min(hi, 0.5);
  if (maxEdge + pad <= source + 0.01) lo = Math.max(lo, maxEdge + pad - visible);
  else lo = Math.max(lo, maxOrigin - 0.5);
  if (minEdge < -0.01 || maxEdge > source + 0.01) return null;
  if (lo > hi + 0.05) return null;
  const ideal = (minEdge + maxEdge) / 2 - visible / 2;
  return Math.min(Math.max(lo, ideal), hi);
}

export function placementFor(
  boxes: FrameBox[],
  aspect: number,
  zoom = 1,
  frameW = 720,
  frameH = 405,
): { position: ObjectPosition; window: FrameBox } | null {
  if (!boxes.length) {
    return { position: { x: 0.5, y: 0.5 }, window: { x1: 0, y1: 0, x2: frameW, y2: frameH } };
  }
  const pad = marginPx(frameH);
  const { visW, visH } = visibleSize(frameW, frameH, aspect, zoom);
  if (visW <= 0 || visH <= 0) return null;
  const minX = Math.min(...boxes.map((box) => box.x1));
  const maxX = Math.max(...boxes.map((box) => box.x2));
  const minY = Math.min(...boxes.map((box) => box.y1));
  const maxY = Math.max(...boxes.map((box) => box.y2));
  const x0 = axisOrigin(minX, maxX, visW, frameW, pad);
  const y0 = axisOrigin(minY, maxY, visH, frameH, pad);
  if (x0 == null || y0 == null) return null;
  const spareX = frameW - visW;
  const spareY = frameH - visH;
  return {
    position: {
      x: spareX <= 0.5 ? 0.5 : x0 / spareX,
      y: spareY <= 0.5 ? 0.5 : y0 / spareY,
    },
    window: { x1: x0, y1: y0, x2: x0 + visW, y2: y0 + visH },
  };
}

function bestEffort(boxes: FrameBox[], aspect: number, frameW: number, frameH: number): ObjectPosition {
  if (!boxes.length) return { x: 0.5, y: 0.5 };
  const { visW, visH } = visibleSize(frameW, frameH, aspect, 1);
  const centersX = boxes.map((box) => (box.x1 + box.x2) / 2);
  const centersY = boxes.map((box) => (box.y1 + box.y2) / 2);
  const place = (minEdge: number, maxEdge: number, visible: number, source: number) => {
    const spare = Math.max(0, source - visible);
    const origin = Math.min(spare, Math.max(0, (minEdge + maxEdge) / 2 - visible / 2));
    return spare <= 0.5 ? 0.5 : origin / spare;
  };
  const spanFits = Math.max(...centersX) - Math.min(...centersX) <= visW;
  return {
    x: place(
      spanFits ? Math.min(...centersX) : Math.min(...boxes.map((box) => box.x1)),
      spanFits ? Math.max(...centersX) : Math.max(...boxes.map((box) => box.x2)),
      visW,
      frameW,
    ),
    y: place(
      Math.min(...centersY),
      Math.max(...centersY),
      visH,
      frameH,
    ),
  };
}

/** Smallest gap from the box union to the source frame, in source pixels. */
export function sourceClearance(boxes: FrameBox[], frameW = 720, frameH = 405): number {
  if (!boxes.length) return Number.POSITIVE_INFINITY;
  const minX = Math.min(...boxes.map((box) => box.x1));
  const maxX = Math.max(...boxes.map((box) => box.x2));
  const minY = Math.min(...boxes.map((box) => box.y1));
  const maxY = Math.max(...boxes.map((box) => box.y2));
  return Math.min(minX, frameW - maxX, minY, frameH - maxY);
}

/**
 * A step may fill the source frame, zoom 1 and no crop, only when the source
 * itself has under 4% clearance around the masks and no chain shape can hold
 * them. A step that already has a valid crop keeps the strict 4% rule.
 */
export function usesSourceEdgeException(boxes: FrameBox[], frameW = 720, frameH = 405): boolean {
  if (!boxes.length) return false;
  if (!(sourceClearance(boxes, frameW, frameH) < marginPx(frameH))) return false;
  return !FRAME_SHAPES.some((shape) => placementFor(boxes, shape.aspect, 1, frameW, frameH));
}

export function requiredAspect(boxes: FrameBox[], frameW = 720, frameH = 405): number {
  if (!boxes.length) return FRAME_SHAPES[0].aspect;
  let lo = 0.5;
  let hi = FRAME_SHAPES[FRAME_SHAPES.length - 1].aspect;
  if (!placementFor(boxes, hi, 1, frameW, frameH)) return hi + 1;
  for (let step = 0; step < 24; step += 1) {
    const mid = (lo + hi) / 2;
    if (placementFor(boxes, mid, 1, frameW, frameH)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Narrowest chain shape that holds every step. Zoom stays 1 unless a later pass needs more. */
export function fitDemo(steps: FrameBox[][], frameW = 720, frameH = 405): DemoFrameFit {
  const exception = steps.map((boxes) => usesSourceEdgeException(boxes, frameW, frameH));
  const needs = steps.map((boxes) => requiredAspect(boxes, frameW, frameH));
  let forcedByStep = exception.findIndex((flag) => !flag);
  if (forcedByStep < 0) forcedByStep = 0;
  for (let index = 0; index < needs.length; index += 1) {
    if (exception[index] || index === forcedByStep) continue;
    if (needs[index] > needs[forcedByStep] + 1e-6) forcedByStep = index;
  }
  const chosen = FRAME_SHAPES.find((shape) => steps.every((boxes, index) => (
    exception[index] || placementFor(boxes, shape.aspect, 1, frameW, frameH)
  ))) ?? FRAME_SHAPES[FRAME_SHAPES.length - 1];
  const fitted = steps.map((boxes, index) => {
    if (exception[index]) return { position: { x: 0.5, y: 0.5 }, zoom: 1, fullFrame: true };
    const placed = placementFor(boxes, chosen.aspect, 1, frameW, frameH);
    return { position: placed?.position ?? { x: 0.5, y: 0.5 }, zoom: 1 };
  });
  const stageFor = (index: number) => (
    fitted[index]?.fullFrame
      ? { width: 390, height: 390 * (frameH / frameW) }
      : sampleStageSize(chosen.id, 390)
  );
  const stepTitle = steps.map((boxes, index) => titlePlacementFor(
    boxes,
    stageFor(index).width,
    stageFor(index).height,
    fitted[index]?.position ?? { x: 0.5, y: 0.5 },
    fitted[index]?.zoom ?? 1,
    frameW,
    frameH,
  ));
  const cardBoxes = steps[0] ?? [];
  const cardAspect = FRAME_SHAPES.find((shape) => shape.id === CARD_SHAPE)?.aspect ?? 4 / 5;
  const cardPlaced = placementFor(cardBoxes, cardAspect, 1, frameW, frameH);
  return {
    shape: chosen.id,
    aspect: chosen.aspect,
    forcedByStep,
    steps: fitted,
    stepTitle,
    card: cardPlaced
      ? { position: cardPlaced.position, zoom: 1, outlines: true }
      : { position: bestEffort(cardBoxes, cardAspect, frameW, frameH), zoom: 1, outlines: false },
  };
}

export function shapeClass(shape: FrameShapeId): string {
  if (shape === "4:5") return "shape-4-5";
  if (shape === "1:1") return "shape-1-1";
  return "shape-5-4";
}

export function boxInsideCrop(box: FrameBox, window: FrameBox, frameW: number, frameH: number): boolean {
  const pad = marginPx(frameH);
  const left = box.x1 - window.x1;
  const right = window.x2 - box.x2;
  const top = box.y1 - window.y1;
  const bottom = window.y2 - box.y2;
  if (left < -0.05 || right < -0.05 || top < -0.05 || bottom < -0.05) return false;
  const leftOk = left + 0.05 >= pad || window.x1 <= 0.75;
  const rightOk = right + 0.05 >= pad || window.x2 >= frameW - 0.75;
  const topOk = top + 0.05 >= pad || window.y1 <= 0.75;
  const bottomOk = bottom + 0.05 >= pad || window.y2 >= frameH - 0.75;
  return leftOk && rightOk && topOk && bottomOk;
}
