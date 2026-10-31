import { describe, expect, it } from "vitest";
import { config } from "../../middleware";
import { previewDecision } from "./preview-auth";
import { previewPathIsGated } from "./preview-gate";

function matcherCovers(pathname: string): boolean {
  const pattern = config.matcher?.[0];
  if (typeof pattern !== "string") return false;
  return new RegExp(`^${pattern}$`).test(pathname);
}

function basic(user: string, password: string) {
  return `Basic ${btoa(`${user}:${password}`)}`;
}

describe("preview auth gate", () => {
  it("stays open when PREVIEW_PASSWORD is unset", () => {
    expect(previewDecision({ password: undefined, authorization: null })).toBe("open");
  });

  it("fails closed when PREVIEW_PASSWORD is set but empty", () => {
    expect(previewDecision({ password: "", authorization: basic("preview", "secret") })).toBe("closed");
    expect(previewDecision({ password: "   ", authorization: null })).toBe("closed");
  });

  it("requires the password on every checked request", () => {
    expect(previewDecision({ password: "secret", authorization: null })).toBe("deny");
    expect(previewDecision({ password: "secret", authorization: basic("preview", "nope") })).toBe("deny");
    expect(previewDecision({ password: "secret", authorization: basic("anyone", "secret") })).toBe("allow");
  });

  it("leaves sample files and the image optimizer ungated, and gates pages and APIs", () => {
    expect(previewPathIsGated("/samples/x.jpg")).toBe(false);
    expect(previewPathIsGated("/_next/image")).toBe(false);
    expect(previewPathIsGated("/_next/static/css/app.css")).toBe(false);
    expect(previewPathIsGated("/favicon.ico")).toBe(false);
    expect(previewPathIsGated("/")).toBe(true);
    expect(previewPathIsGated("/api/segment")).toBe(true);
    expect(matcherCovers("/samples/x.jpg")).toBe(false);
    expect(matcherCovers("/_next/image")).toBe(false);
    expect(matcherCovers("/_next/static/chunks/app.js")).toBe(false);
    expect(matcherCovers("/")).toBe(true);
    expect(matcherCovers("/api/segment")).toBe(true);
    expect(matcherCovers("/coach")).toBe(true);
  });
});
