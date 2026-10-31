import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { SafetyNote } from "./SafetyNote";

describe("supervision note", () => {
  it("renders the grown-up note and nothing when a demo has none", () => {
    const shown = renderToStaticMarkup(createElement(SafetyNote, { note: "Grown-up supervision" }));
    expect(shown).toContain("supervision-note");
    expect(shown).toContain("Grown-up supervision");
    expect(shown).not.toContain("\u2014");
    expect(renderToStaticMarkup(createElement(SafetyNote, { note: "  " }))).toBe("");
    expect(renderToStaticMarkup(createElement(SafetyNote, {}))).toBe("");
  });

  it("is mounted on the demo card and the coach", () => {
    expect(readFileSync("src/ui/Landing.tsx", "utf8")).toContain("<SafetyNote");
    expect(readFileSync("src/ui/CoachScreen.tsx", "utf8")).toContain("<SafetyNote");
  });
});
