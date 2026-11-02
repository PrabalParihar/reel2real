import { describe, expect, it } from "vitest";
import { sessionStatusLabel } from "./session-status";

describe("session status provenance", () => {
  it("never claims live before an executed result", () => {
    expect(sessionStatusLabel({ source: null, provenance: null, sampleRun: false })).toBeNull();
  });
  it("labels saved and recorded plans by their actual source", () => {
    expect(sessionStatusLabel({ source: "cache", provenance: { mode: "live" }, sampleRun: false })).toBe("Cached");
    expect(sessionStatusLabel({ source: "sample", provenance: { mode: "mock" }, sampleRun: true })).toBe("Sample");
  });
  it("does not turn a configured worker's mock result into Live", () => {
    expect(sessionStatusLabel({ source: "clip", provenance: { mode: "mock" }, sampleRun: false })).toBe("Mock");
    expect(sessionStatusLabel({ source: "instruct", provenance: { mode: "live" }, sampleRun: false })).toBe("Live");
  });
});
