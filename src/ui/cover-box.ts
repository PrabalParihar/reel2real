import { coverTransform, frameToView } from "@/src/samples/mask-geometry";

export interface NormBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Map a 0–1 box in the camera frame onto a stage that draws that frame with
 * object-fit: cover. The live video and the SAM jpeg share the full frame;
 * a narrow stage crops it.
 */
export function coverNormalizedBox(
  box: NormBox,
  frameW: number,
  frameH: number,
  viewW: number,
  viewH: number,
): NormBox {
  if (frameW <= 0 || frameH <= 0 || viewW <= 0 || viewH <= 0) return box;
  const cover = coverTransform(frameW, frameH, viewW, viewH);
  const start = frameToView(box.x * frameW, box.y * frameH, frameW, frameH, cover);
  const end = frameToView((box.x + box.w) * frameW, (box.y + box.h) * frameH, frameW, frameH, cover);
  return {
    x: start.x / viewW,
    y: start.y / viewH,
    w: (end.x - start.x) / viewW,
    h: (end.y - start.y) / viewH,
  };
}
