import { describe, expect, it } from "vitest";
import { extractionReducer as reduce, extractPreparedLesson as run, type ExtractionState, extractionStageLabel } from "./extraction-run";
import type { SparkResult } from "@/src/server/types";
import type { CachedSteps } from "./steps-cache";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import type { PrepareRequest } from "./session";

const prepare: PrepareRequest = { key: "upload", hasClip: true, clipHash: "sha", title: "Edited upload", creatorName: "Uploader", licenceChoice: "self_filmed" };
const next: PrepareRequest = { key: "sample", hasClip: false, sampleId: PUBLISHED_SAMPLES[1].id };
const tutorial = PUBLISHED_SAMPLES[0].tutorial;
const result: SparkResult = { mode: "live", modelId: "muse-spark-1.3", latencyMs: 50, schemaValid: true, parseOk: true, errors: [], tutorial, toolCalls: [], inputKind: "clip" };
const state: ExtractionState = { prepare, elapsed: 100, stage: "preparing", attempt: 1, manualRetries: 0, error: "old error", refusal: "old refusal", coachingOff: true, capped: true };
const deps = { read: async () => null, write: async () => true, post: async () => result };

describe("extraction lifecycle", () => {
  it("new lesson selection resets every prior terminal and progress value", () => {
    expect(reduce(state, { type: "start", prepare: next })).toEqual({ prepare: next, elapsed: 0, stage: "reading", attempt: 0, manualRetries: 0, error: null, refusal: null, coachingOff: false, capped: false });
  });

  it("late prior progress and terminal events cannot change the current lesson", () => {
    const current = { ...state, prepare: next };
    expect(reduce(current, { type: "error", prepare, message: "late" })).toBe(current);
    expect(reduce(current, { type: "stage", prepare, stage: "reading" })).toBe(current);
    expect(reduce(current, { type: "cap", prepare })).toBe(current);
  });

  it("describes recorded loading and validation as saved instruction work", () => {
    const label = (stage: "reading" | "validating" | "preparing") => extractionStageLabel(stage, next);
    expect(label("reading")).toBe("Loading saved instructions");
    expect(label("validating")).toBe("Checking saved instructions");
    expect(label("preparing")).toBe("Preparing recorded coach");
  });

  it("an explicit retry retains the input and prior automatic retry allowance", () => {
    const failed = { ...state, error: "Network failure", refusal: null, coachingOff: false, capped: false, manualRetries: 0 };
    expect(reduce(failed, { type: "retry", prepare })).toMatchObject({ prepare, error: null, elapsed: 0, stage: "upload", attempt: 1, manualRetries: 1 });
  });

  it("allows two user retries and rejects retries while running or after the limit", () => {
    let failed: ExtractionState = { ...state, error: "Network failure", refusal: null, coachingOff: false, capped: false, manualRetries: 0 };
    const running = reduce(failed, { type: "retry", prepare });
    expect(running).toBeDefined();
    expect(reduce(running, { type: "retry", prepare })).toBe(running);
    failed = { ...running, error: "Network failure again" };
    const retryTwo = reduce(failed, { type: "retry", prepare });
    const exhausted = { ...retryTwo, error: "Still unavailable" };
    expect(reduce(exhausted, { type: "retry", prepare })).toBe(exhausted);
  });

  it("valid current extraction survives a failed persistence write", async () => {
    expect(await run(prepare, {}, { ...deps, write: async () => { throw new Error("QuotaExceededError"); } })).toMatchObject({ kind: "tutorial", tutorial, source: "clip", provenance: { mode: "live", modelId: "muse-spark-1.3" }, persistenceNote: "Steps are ready. This browser could not save them for reuse." });
  });

  it("storage read failure still produces the valid current tutorial", async () => {
    expect(await run(prepare, {}, { ...deps, read: async () => { throw new Error("private mode"); } })).toMatchObject({ kind: "tutorial", tutorial, source: "clip" });
  });

  it("a validated cache hit preserves its original mock provenance", async () => {
    const cached: CachedSteps = { tutorial, toolCalls: [], inputKind: "clip", provenance: { mode: "mock", modelId: null } };
    expect(await run(prepare, {}, { ...deps, read: async () => cached, post: async () => { throw new Error("A cache hit must not call Spark"); } })).toMatchObject({ kind: "tutorial", tutorial, source: "cache", provenance: { mode: "mock", modelId: null } });
  });

  it("daily cap offers an explicit choice instead of replacing the upload", async () => {
    const error = Object.assign(new Error("Daily cap"), { code: "daily_cap" });
    expect(await run(prepare, {}, { ...deps, post: async () => { throw error; } })).toEqual({ kind: "cap" });
    expect(prepare.creatorName).toBe("Uploader");
    expect(prepare.sampleId).toBeUndefined();
  });

  it("an aborted request cannot publish a result after its transport resolves", async () => {
    const controller = new AbortController();
    await expect(run(prepare, { signal: controller.signal }, { ...deps, post: async () => { controller.abort(); return result; } })).rejects.toMatchObject({ name: "AbortError" });
  });
});
