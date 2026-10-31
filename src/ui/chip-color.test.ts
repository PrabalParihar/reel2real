import { describe, expect, it } from "vitest";
import { DEMOS } from "@/src/samples/demos";
import { CHIP_BACKING, chipBackingWorst, contrastRatio, parseHex, readableChipColor } from "./chip-color";

const NOUNS = DEMOS.flatMap((demo) => demo.scene.steps.flatMap((step) => step.nouns
  .filter((noun) => noun.noun.trim() && noun.color.trim())
  .map((noun) => [noun.noun, noun.color] as const)));

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
