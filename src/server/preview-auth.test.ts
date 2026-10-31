import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, middleware } from "../../middleware";
import { previewDecision } from "./preview-auth";
import { INTERNAL_SEGMENT_PATH, previewPathIsGated } from "./preview-gate";

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
    expect(previewPathIsGated("/api/spark")).toBe(true);
    expect(previewPathIsGated("/api/runtime")).toBe(true);
    expect(matcherCovers("/samples/x.jpg")).toBe(false);
    expect(matcherCovers("/_next/image")).toBe(false);
    expect(matcherCovers("/_next/static/chunks/app.js")).toBe(false);
    expect(matcherCovers("/")).toBe(true);
    expect(matcherCovers("/api/segment")).toBe(true);
    expect(matcherCovers("/coach")).toBe(true);
  });

  it("skips basic auth only for the internal segment path", () => {
    expect(previewPathIsGated(INTERNAL_SEGMENT_PATH)).toBe(false);
    expect(previewPathIsGated("/api/internal/segment/")).toBe(true);
    expect(previewPathIsGated("/api/internal/segment/extra")).toBe(true);
    expect(previewPathIsGated("/api/internal")).toBe(true);
    expect(matcherCovers(INTERNAL_SEGMENT_PATH)).toBe(true);

    const previous = process.env.PREVIEW_PASSWORD;
    process.env.PREVIEW_PASSWORD = "preview-secret";
    try {
      const internal = middleware(new NextRequest(`http://preview.local${INTERNAL_SEGMENT_PATH}`));
      const segment = middleware(new NextRequest("http://preview.local/api/segment"));
      const spark = middleware(new NextRequest("http://preview.local/api/spark"));
      const home = middleware(new NextRequest("http://preview.local/"));
      const coach = middleware(new NextRequest("http://preview.local/coach"));
      expect(internal.status).toBe(200);
      expect(segment.status).toBe(401);
      expect(spark.status).toBe(401);
      expect(home.status).toBe(401);
      expect(coach.status).toBe(401);
      expect(internal.headers.get("www-authenticate")).toBeNull();
      expect(segment.headers.get("www-authenticate")).toContain("Basic");

      process.env.PREVIEW_PASSWORD = "";
      const internalWhenClosed = middleware(new NextRequest(`http://preview.local${INTERNAL_SEGMENT_PATH}`));
      const segmentWhenClosed = middleware(new NextRequest("http://preview.local/api/segment"));
      expect(internalWhenClosed.status).toBe(200);
      expect(segmentWhenClosed.status).toBe(503);
    } finally {
      if (previous === undefined) delete process.env.PREVIEW_PASSWORD;
      else process.env.PREVIEW_PASSWORD = previous;
    }
  });
});
