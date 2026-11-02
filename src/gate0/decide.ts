export type GateDecision = "pass_mvp" | "stills_only" | "nogo_escalate" | "unverified_mock";
export type GateLiveMode = "chunk_video_1_2s" | "keyframe_still" | "stills_only";

export interface GateRun {
  sam_still_ok: boolean | null;
  sam_still_full_ms: number | null;
  sam_clip_ok: boolean;
  sam_clip_full_ms: number | null;
  sam_clip_timed_out: boolean;
  sam_objects_returned: number;
  spark_ok: boolean;
  spark_latency_ms: number | null;
  spark_json_parse_ok: boolean;
  spark_schema_valid: boolean;
  steps_count: number;
}

export interface GateDecisionResult {
  decision: GateDecision;
  liveMode: GateLiveMode;
  fallbackArmed: boolean;
  reason: string;
  medianClipMs: number | null;
  medianStillMs: number | null;
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function decideGate0(runs: GateRun[], mode: "live" | "mock"): GateDecisionResult {
  const clipSamples = runs.map((run) => (run.sam_clip_timed_out || run.sam_clip_full_ms == null ? Number.POSITIVE_INFINITY : run.sam_clip_full_ms));
  const finiteClip = clipSamples.filter((value) => Number.isFinite(value));
  const medianClipMs = median(finiteClip);
  const stillSamples = runs.map((run) => run.sam_still_full_ms).filter((value): value is number => value != null && Number.isFinite(value));
  const medianStillMs = median(stillSamples);
  const stillMeasured = runs.some((run) => run.sam_still_ok != null);
  const stillOk = runs.filter((run) => run.sam_still_ok === true).length >= Math.ceil(runs.length / 2);
  const sparkOk = runs.every((run) => run.spark_ok && run.spark_json_parse_ok && run.spark_schema_valid && run.steps_count >= 1);
  const objectsOk = (median(runs.map((run) => run.sam_objects_returned)) ?? 0) >= 2;
  const clipTimeout = runs.some((run) => run.sam_clip_timed_out) && finiteClip.length < runs.length;
  const clipOk = runs.every((run) => run.sam_clip_ok && !run.sam_clip_timed_out);

  if (mode === "mock") {
    return {
      decision: "unverified_mock",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: "Mock clients supplied no live model evidence. A controlled live run is required.",
      medianClipMs,
      medianStillMs,
    };
  }
  if (!sparkOk) {
    return {
      decision: "nogo_escalate",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: "Spark did not return schema-valid steps in every run.",
      medianClipMs,
      medianStillMs,
    };
  }
  if (!objectsOk) {
    return {
      decision: "nogo_escalate",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: "Fewer than 2 objects came back with a mask.",
      medianClipMs,
      medianStillMs,
    };
  }
  if (clipOk && medianClipMs != null && medianClipMs <= 2000 && finiteClip.length === runs.length && stillOk) {
    return {
      decision: "pass_mvp",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: `Median full clip request completion is ${Math.round(medianClipMs)} ms. The implemented browser camera path uses keyframe stills.`,
      medianClipMs,
      medianStillMs,
    };
  }
  const clipInKeyframeBand = medianClipMs != null && medianClipMs <= 5000;
  if (clipOk && clipInKeyframeBand && stillMeasured && stillOk) {
    return {
      decision: "pass_mvp",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: `Median full clip request completion is ${Math.round(medianClipMs)} ms, within 5000 ms. Use keyframe stills.`,
      medianClipMs,
      medianStillMs,
    };
  }
  if ((!clipOk || clipTimeout || (medianClipMs != null && medianClipMs > 5000) || medianClipMs == null) && stillOk) {
    return {
      decision: "stills_only",
      liveMode: "stills_only",
      fallbackArmed: true,
      reason: "Full clip requests failed, exceeded 5000 ms, or timed out. Stills still return masks.",
      medianClipMs,
      medianStillMs,
    };
  }
  return {
    decision: "nogo_escalate",
    liveMode: "stills_only",
    fallbackArmed: false,
    reason: "Clip and still paths did not both support a coaching mode.",
    medianClipMs,
    medianStillMs,
  };
}
