/** Outfit at the coach weight is about this wide. Sized so the estimate stays inside four lines. */
const CHAR_EM = 0.56;
const COLUMN_PX = 320;
const SIZES = [44, 40, 36, 32, 28, 26, 24, 22, 20, 18];

export function stepHeadlineFontPx(text: string, columnPx = COLUMN_PX): number {
  const chars = Math.max(text.trim().length, 1);
  for (const size of SIZES) {
    const perLine = Math.max(1, Math.floor(columnPx / (size * CHAR_EM)));
    if (Math.ceil(chars / perLine) <= 4) return size;
  }
  return SIZES[SIZES.length - 1];
}

export function stepHeadlineLines(text: string, fontPx: number, columnPx = COLUMN_PX): number {
  const chars = Math.max(text.trim().length, 1);
  const perLine = Math.max(1, Math.floor(columnPx / (fontPx * CHAR_EM)));
  return Math.ceil(chars / perLine);
}
