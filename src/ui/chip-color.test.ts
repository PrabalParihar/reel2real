import { describe, expect, it } from "vitest";
import { CHIP_BACKING, chipBackingWorst, contrastRatio, parseHex, readableChipColor } from "./chip-color";

const NOUNS = [
  ["mortar", "#E88C30"],
  ["pestle", "#2DB4AA"],
  ["spices", "#B450A0"],
  ["hand", "#50A0E6"],
];

describe("on-video chip contrast", () => {
  it("brightens each outline colour to at least 4.5:1 on the chip backing", () => {
    const worst = chipBackingWorst();
    for (const [noun, hex] of NOUNS) {
      const readable = readableChipColor(hex);
      const onWorst = contrastRatio(parseHex(readable), worst);
      const onSolid = contrastRatio(parseHex(readable), CHIP_BACKING);
      console.log(`${noun} ${hex} -> ${readable} worst ${onWorst.toFixed(2)} solid ${onSolid.toFixed(2)}`);
      expect(onWorst).toBeGreaterThanOrEqual(4.5);
      expect(onSolid).toBeGreaterThanOrEqual(4.5);
    }
  });
});
