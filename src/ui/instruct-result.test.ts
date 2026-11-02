import { describe, expect, it } from "vitest";
import tutorial from "@/src/fixtures/sample-aloo-jeera.steps.json";
import { REFUSAL_UNSAFE } from "@/src/safety/goal-screen";
import type { SparkResult } from "@/src/server/types";
import { interpretInstructResponse } from "./instruct-result";

function success(): SparkResult {
  return {
    mode: "live", modelId: "muse-spark-1.3", latencyMs: 25,
    schemaValid: true, parseOk: true, errors: [],
    tutorial: structuredClone(tutorial) as SparkResult["tutorial"],
    toolCalls: [{ tool: "muse_spark", modelId: "muse-spark-1.3", purpose: "plan_from_still" }],
    inputKind: "instruct",
  };
}

describe("instruction response boundary", () => {
  it("publishes a checked instruction result and tutorial", () => {
    const outcome = interpretInstructResponse(success(), true);
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.result).toMatchObject({
      mode: "live", modelId: "muse-spark-1.3", latencyMs: 25,
      inputKind: "instruct", schemaValid: true,
      toolCalls: [{ tool: "muse_spark", modelId: "muse-spark-1.3", purpose: "plan_from_still" }],
      tutorial: { title: "Sample · Aloo jeera, onion prep" },
    });
    expect(outcome.result.tutorial.steps.length).toBeGreaterThan(0);
  });

  it.each([
    { tutorial: { title: "bad" } },
    { tutorial: { ...tutorial, steps: [] } },
    { tutorial: null },
    { mode: "unknown" },
    { mode: ["live"] },
    { latencyMs: -1 },
    { latencyMs: "25" },
    { latencyMs: Number.NaN },
    { modelId: {} },
    { parseOk: false },
    { errors: {} },
    { errors: [{}] },
    { toolCalls: {} },
    { toolCalls: [{ tool: "unrecognized", modelId: "model", purpose: "plan" }] },
    { toolCalls: [{ tool: ["tts"], modelId: "model", purpose: "plan" }] },
    { toolCalls: [{ tool: "muse_spark", modelId: {}, purpose: "plan" }] },
    { inputKind: "sample" },
    { inputKind: ["instruct"] },
    { schemaValid: "true" },
  ])("returns a recoverable error for a claimed successful malformed plan %j", (fields) => {
    const outcome = interpretInstructResponse({ ...success(), ...fields }, true);
    expect(outcome.kind).toBe("error");
    if (outcome.kind !== "error") return;
    expect(typeof outcome.message).toBe("string");
    expect(outcome.message.trim().length).toBeGreaterThan(0);
  });

  it.each([null, [], "not an object", 12])("handles an unreadable body %j", (body) => {
    expect(interpretInstructResponse(body, true)).toMatchObject({ kind: "error" });
  });

  it("keeps explicit refusal ahead of degraded mode and HTTP failures", () => {
    expect(interpretInstructResponse({ refused: true, reason: "Use a safe household goal.", mode: "degraded" }, false))
      .toEqual({ kind: "refusal", reason: "Use a safe household goal." });
  });

  it("preserves a model refusal reason and detects safety text", () => {
    expect(interpretInstructResponse({ refused: true, refusalReason: "Choose another goal." }, true))
      .toEqual({ kind: "refusal", reason: "Choose another goal." });
    expect(interpretInstructResponse({ mode: "degraded", message: "I cannot assist with this request." }, true))
      .toEqual({ kind: "refusal", reason: REFUSAL_UNSAFE });
    expect(interpretInstructResponse({ errors: [{}, "I must refuse this goal."] }, false))
      .toEqual({ kind: "refusal", reason: REFUSAL_UNSAFE });
  });

  it("never treats untrusted refusal fields as displayable values", () => {
    expect(interpretInstructResponse({ refused: true, reason: {}, refusalReason: [], message: {} }, true))
      .toEqual({ kind: "refusal", reason: REFUSAL_UNSAFE });
    expect(interpretInstructResponse({ reason: {}, refusalReason: "Choose another goal.", refused: true, errors: {} }, true))
      .toEqual({ kind: "refusal", reason: "Choose another goal." });
  });

  it("keeps degraded mode ahead of ordinary errors", () => {
    expect(interpretInstructResponse({ mode: "degraded", errors: [{}], message: {} }, false))
      .toEqual({ kind: "off" });
  });

  it("does not publish a valid-looking plan after an HTTP failure", () => {
    expect(interpretInstructResponse({ ...success(), message: "Daily call limit reached." }, false))
      .toEqual({ kind: "error", message: "Daily call limit reached." });
  });

  it("does not publish a valid-looking plan carrying an explicit service error", () => {
    expect(interpretInstructResponse({ ...success(), error: "spark_failed", message: "Try again later." }, true))
      .toEqual({ kind: "error", message: "Try again later." });
  });

  it("preserves a schema failure message without publishing its tutorial", () => {
    expect(interpretInstructResponse({ ...success(), schemaValid: false, errors: ["The plan needs at least one object."] }, true))
      .toEqual({ kind: "error", message: "The plan needs at least one object." });
  });

  it("uses only safe strings for recoverable error copy", () => {
    expect(interpretInstructResponse({ message: {}, errors: [{}, "The service is busy."] }, false))
      .toEqual({ kind: "error", message: "The service is busy." });
    const outcome = interpretInstructResponse({ message: [], errors: {}, reason: {} }, false);
    expect(outcome).toMatchObject({ kind: "error" });
    if (outcome.kind === "error") expect(typeof outcome.message).toBe("string");
  });
});
