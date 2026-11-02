import { describe, expect, it } from "vitest";
import { sessionReducer as reduce, prepareSample as sample, type SessionState } from "./session";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import type { PrepareRequest } from "./session";

const upload: PrepareRequest = { key: "upload", hasClip: true, videoBase64: "abc", clipHash: "hash", creatorName: "Uploader", licenceChoice: "self_filmed" };
const initial: SessionState = { prepare: null, tutorial: null, videoUrl: null, toolLog: [], sparkLatencyMs: null, stepsSource: null, summary: null, resultProvenance: null, uploadDraft: null, persistenceNote: null };

describe("lesson identity and session transitions", () => {
  it("prepares every selected published sample with its own identity and source credits", () => {
    for (const published of PUBLISHED_SAMPLES) {
      const prepared = sample(published.id);
      expect(prepared).toMatchObject({ sampleId: published.id, hasClip: false, creatorName: published.creatorName });
      // Supplying a user licence would rewrite the original sample credit in the server client.
      expect(prepared?.licenceChoice).toBeUndefined();
      expect(prepared?.videoBase64).toBeUndefined();
    }
    expect(sample("unknown-sample")).toBeNull();
  });

  it("a new request clears prior tutorial, timing, tools, source and recap", () => {
    const previous: SessionState = { ...initial, prepare: upload, videoUrl: "blob:upload", tutorial: PUBLISHED_SAMPLES[0].tutorial, toolLog: [{ tool: "muse_spark", modelId: "test", purpose: "test" }], sparkLatencyMs: 123, stepsSource: "clip", summary: { title: "prior", steps: 1, skips: 0, safetyHits: 0, skippedStepIds: [] }, resultProvenance: { mode: "live", modelId: "prior" } };
    const next = sample(PUBLISHED_SAMPLES[1].id);
    expect(reduce(previous, { type: "prepare", prepare: next!, videoUrl: null })).toMatchObject({ ...initial, prepare: next, uploadDraft: { prepare: upload, videoUrl: "blob:upload" } });
  });

  it("a late tutorial result cannot replace a newly selected lesson", () => {
    const next = sample(PUBLISHED_SAMPLES[1].id);
    const state = { ...initial, prepare: next };
    expect(reduce(state, { type: "tutorial", expectedPrepare: upload, tutorial: PUBLISHED_SAMPLES[0].tutorial, latencyMs: 4, toolCalls: [], source: "clip" })).toBe(state);
  });

  it("does not label a goal-only preparation as an uploaded clip draft", () => {
    const goal = { key: "goal", hasClip: false, transcript: "Fold a shirt" };
    const previous = { ...initial, prepare: goal };
    expect(reduce(previous, { type: "prepare", prepare: sample(PUBLISHED_SAMPLES[0].id)!, videoUrl: null }).uploadDraft).toBeNull();
  });

  it("restores an uploaded draft after an explicit sample fallback", () => {
    const state = { ...initial, prepare: sample(PUBLISHED_SAMPLES[0].id), tutorial: PUBLISHED_SAMPLES[0].tutorial, uploadDraft: { prepare: upload, videoUrl: "blob:upload" } };
    expect(reduce(state, { type: "restore_draft" })).toMatchObject({ ...initial, prepare: upload, videoUrl: "blob:upload" });
  });
});
