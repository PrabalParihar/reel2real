/** 720x405. 0.5% is 1,458 px, above the spice specks and below every kept object. */
export const MIN_FRAME_FRACTION = 0.005;
/** A drawn mask must occupy a real share of its own box, not a few strokes in a loose rect. */
export const MIN_BOX_FILL = 0.15;
/** A box this close to the frame counts as touching the edge. */
export const EDGE_TOUCH_PX = 2;
/** Touching the frame and thinner than this is a sliver, not an object. */
export const EDGE_SLIVER_MIN_SIDE = 36;

export interface SanityBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MaskSanity {
  pass: boolean;
  frameFraction: number;
  boxFill: number;
  edgeSliver: boolean;
  onPixels: number;
  boxArea: number;
}

export function assessMask(
  onPixels: number,
  box: SanityBox,
  frameW = 720,
  frameH = 405,
): MaskSanity {
  const width = Math.max(0, box.x2 - box.x1);
  const height = Math.max(0, box.y2 - box.y1);
  const boxArea = Math.max(1, width * height);
  const frameFraction = onPixels / (frameW * frameH);
  const boxFill = onPixels / boxArea;
  const shortSide = Math.min(width, height);
  const touches = box.x1 <= EDGE_TOUCH_PX
    || box.y1 <= EDGE_TOUCH_PX
    || box.x2 >= frameW - EDGE_TOUCH_PX
    || box.y2 >= frameH - EDGE_TOUCH_PX;
  const edgeSliver = touches && shortSide < EDGE_SLIVER_MIN_SIDE;
  return {
    pass: frameFraction >= MIN_FRAME_FRACTION && boxFill >= MIN_BOX_FILL && !edgeSliver,
    frameFraction,
    boxFill,
    edgeSliver,
    onPixels,
    boxArea,
  };
}
