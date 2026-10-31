export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** #0b0d12 at 85% over white. The lightest the chip backing can read on a pale frame. */
export const CHIP_BACKING: Rgb = { r: 11, g: 13, b: 18 };
export const CHIP_BACKING_ALPHA = 0.85;

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
  };
}

/** Worst-case backing: the 85% chip over a white photo. */
export function chipBackingWorst(): Rgb {
  return blend(CHIP_BACKING, { r: 255, g: 255, b: 255 }, CHIP_BACKING_ALPHA);
}

export function parseHex(hex: string): Rgb {
  const raw = hex.replace("#", "");
  const value = Number.parseInt(raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function toHex(color: Rgb): string {
  const part = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${part(color.r)}${part(color.g)}${part(color.b)}`;
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  };
}

/** Keep the outline hue, lightened until the chip text clears 4.5:1 on the backing. */
export function readableChipColor(hex: string, minimum = 4.5): string {
  const source = parseHex(hex);
  const worst = chipBackingWorst();
  const solid = CHIP_BACKING;
  for (let step = 0; step <= 24; step += 1) {
    const color = mix(source, { r: 255, g: 255, b: 255 }, step / 24);
    if (contrastRatio(color, worst) >= minimum && contrastRatio(color, solid) >= minimum) return toHex(color);
  }
  return "#ffffff";
}
