import { describe, expect, it } from "vitest";
import { previewDecision } from "./preview-auth";

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
});
