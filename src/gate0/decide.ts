export type GateDecision = "pass_mvp" | "stills_only" | "nogo_escalate" | "unverified_mock";
export type GateLiveMode = "chunk_video_1_2s" | "keyframe_still" | "stills_only";

export interface GateRun {
  sam_still_ok: boolean | null;
  sam_still_ttfm_ms: number | null;
  sam_clip_ok: boolean;
  sam_clip_ttfm_ms: number | null;
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
  const clipSamples = runs.map((run) => (run.sam_clip_timed_out || run.sam_clip_ttfm_ms == null ? Number.POSITIVE_INFINITY : run.sam_clip_ttfm_ms));
  const finiteClip = clipSamples.filter((value) => Number.isFinite(value));
  const medianClipMs = median(finiteClip);
  const stillSamples = runs.map((run) => run.sam_still_ttfm_ms).filter((value): value is number => value != null && Number.isFinite(value));
  const medianStillMs = median(stillSamples);
  const stillMeasured = runs.some((run) => run.sam_still_ok != null);
  const stillOk = runs.filter((run) => run.sam_still_ok === true).length >= Math.ceil(runs.length / 2);
  const sparkOk = runs.every((run) => run.spark_ok && run.spark_json_parse_ok && run.spark_schema_valid && run.steps_count >= 1);
  const objectsOk = (median(runs.map((run) => run.sam_objects_returned)) ?? 0) >= 2;
  const clipTimeout = runs.some((run) => run.sam_clip_timed_out) && finiteClip.length < runs.length;

  if (mode === "mock") {
    return {
      decision: "unverified_mock",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: "No API key. Mock timings are not a Gate 0 measurement. Reported Gate 0 is pass_mvp in keyframe-still mode (still 922 ms, 2s chunk 2213 ms).",
      medianClipMs,
      medianStillMs,
    };
  }
  if (!sparkOk) {
    return {
      decision: "nogo_escalate",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: "Spark did not return schema-valid steps after the allowed retry.",
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
  if (medianClipMs != null && medianClipMs <= 2000 && finiteClip.length === runs.length) {
    return {
      decision: "pass_mvp",
      liveMode: "chunk_video_1_2s",
      fallbackArmed: false,
      reason: `Median time to first mask on the clip is ${Math.round(medianClipMs)} ms, within the 2000 ms live threshold.`,
      medianClipMs,
      medianStillMs,
    };
  }
  const clipInKeyframeBand = medianClipMs != null && medianClipMs <= 5000;
  if (clipInKeyframeBand && (!stillMeasured || stillOk)) {
    return {
      decision: "pass_mvp",
      liveMode: "keyframe_still",
      fallbackArmed: false,
      reason: `Median clip time to first mask is ${Math.round(medianClipMs)} ms, over 2000 ms and within 5000 ms. Use keyframe stills.`,
      medianClipMs,
      medianStillMs,
    };
  }
  if ((clipTimeout || (medianClipMs != null && medianClipMs > 5000) || medianClipMs == null) && stillOk) {
    return {
      decision: "stills_only",
      liveMode: "stills_only",
      fallbackArmed: true,
      reason: "Clip time to first mask is over 5000 ms or timed out. Stills still return masks.",
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
