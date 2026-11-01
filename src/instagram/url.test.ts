import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IG_CREDIT_IN_POST, IG_SAVE_HINT, IG_USER_COPY, IG_VIEW, instagramCredit } from "./copy";
import { parsePublicInstagramUrl } from "./url";

describe("public Instagram URL", () => {
  it("accepts instagram.com /reel/ and /p/ links", () => {
    expect(parsePublicInstagramUrl("https://www.instagram.com/reel/AbC12_x/")).toBe("https://www.instagram.com/reel/AbC12_x/");
    expect(parsePublicInstagramUrl("https://instagram.com/p/ZZ99aa/?igsh=1")).toBe("https://www.instagram.com/p/ZZ99aa/");
    expect(parsePublicInstagramUrl("  HTTPS://WWW.INSTAGRAM.COM/reel/hello1  ")).toBe("https://www.instagram.com/reel/hello1/");
  });

  it("rejects other hosts, paths, and schemes", () => {
    const rejected = [
      "",
      "not a url",
      "http://www.instagram.com/reel/AbC12_x/",
      "https://instagr.am/reel/AbC12_x/",
      "https://www.instagram.com.evil.com/reel/AbC12_x/",
      "https://evil.com/reel/AbC12_x/",
      "https://www.instagram.com/stories/name/123/",
      "https://www.instagram.com/tv/AbC12_x/",
      "https://www.instagram.com/reel/AbC12_x/extra/",
      "https://www.instagram.com/reels/AbC12_x/",
      "https://user:pass@www.instagram.com/reel/AbC12_x/",
      "javascript:alert(1)",
    ];
    for (const value of rejected) expect(parsePublicInstagramUrl(value), value).toBeNull();
  });

  it("keeps the save hint and never says import", () => {
    expect(IG_SAVE_HINT).toBe("Save the Reel to your phone, then upload or share the file here.");
    expect(readFileSync("src/ui/InstagramShow.tsx", "utf8")).toContain("IG_SECTION_TITLE");
    const copy = readFileSync("src/instagram/copy.ts", "utf8");
    expect(copy).not.toMatch(/\bimport\b/i);
    expect(copy).not.toMatch(/scrape|download|WitLabs/i);
    expect(copy).not.toContain("\u2014");
    expect(copy).not.toContain("\u2013");
    for (const line of IG_USER_COPY) {
      expect(line).not.toMatch(/\bimport\b/i);
      expect(line).not.toContain("\u2014");
      expect(line).not.toContain("\u2013");
    }
  });

  it("credits a named author and does not invent one when oEmbed omits the name", () => {
    expect(instagramCredit("diegoquinteiro")).toEqual({
      credit: "Credit: diegoquinteiro on Instagram",
      authorKnown: true,
    });
    expect(instagramCredit("Ada Cook").credit).toBe("Credit: Ada Cook on Instagram");
    for (const missing of [undefined, "", "   "]) {
      const result = instagramCredit(missing);
      expect(result.authorKnown).toBe(false);
      expect(result.credit).toBe(IG_CREDIT_IN_POST);
      expect(result.credit).not.toMatch(/Credit: Instagram/);
      expect(result.credit).not.toContain("\u2014");
      expect(result.credit).not.toContain("\u2013");
    }
    expect(IG_VIEW).toBe("View on Instagram");
    const ui = readFileSync("src/ui/InstagramShow.tsx", "utf8");
    expect(ui).toContain("instagramCredit");
    expect(ui).toContain("IG_VIEW");
    expect(ui).not.toContain("Credit ·");
  });
});
