import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const COPY = [
  "README.md",
  "docs/demo-script.md",
  "docs/SUBMISSION-DRAFT.md",
  "docs/ADD-A-DEMO.md",
  "build/README.md",
  "public/samples/CREDITS.md",
  "src/ui/Landing.tsx",
  "src/ui/CoachScreen.tsx",
  "src/ui/SafetyNote.tsx",
];

describe("submission copy", () => {
  it("has no em dash, no WitLabs, and does not name gate0.mp4", () => {
    for (const file of COPY) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toContain("\u2014");
      expect(text, file).not.toMatch(/WitLabs/i);
      expect(text, file).not.toContain("gate0.mp4");
    }
  });

  it("keeps the submission write-up as a draft", () => {
    const text = readFileSync("docs/SUBMISSION-DRAFT.md", "utf8");
    expect(text.startsWith("# DRAFT")).toBe(true);
    expect(text).toContain("Do not submit");
    expect(text.toLowerCase()).not.toContain("submitted on");
  });
});
