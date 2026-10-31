export interface ParsedBox {
  frame: string;
  ordinal: string;
  box?: { x: number; y: number; w: number; h: number };
}

/** Pull SAM box tokens into 0–1 rects. Missing numbers mean no overlay. */
export function parseSamBoxes(text: string): ParsedBox[] {
  const found: ParsedBox[] = [];
  const pattern = /<(\d+)f>(\d+)<\|box;([^|>]+)\|>/g;
  for (const match of text.matchAll(pattern)) {
    const attrs = Object.fromEntries(
      (match[3] ?? "").split(";").map((part) => {
        const [key, value] = part.split("=");
        return [key, Number(value)];
      }),
    );
    const frameW = attrs.w;
    const frameH = attrs.h;
    const x1 = attrs.x1;
    const y1 = attrs.y1;
    const x2 = attrs.x2;
    const y2 = attrs.y2;
    const usable = [frameW, frameH, x1, y1, x2, y2].every((value) => Number.isFinite(value) && value >= 0) && frameW > 0 && frameH > 0 && x2 > x1 && y2 > y1;
    found.push({
      frame: match[1] ?? "0",
      ordinal: match[2] ?? "0",
      box: usable
        ? { x: x1 / frameW, y: y1 / frameH, w: (x2 - x1) / frameW, h: (y2 - y1) / frameH }
        : undefined,
    });
  }
  if (!found.length && /<\|(?:box|mask);/.test(text)) found.push({ frame: "0", ordinal: "0" });
  return found;
}
