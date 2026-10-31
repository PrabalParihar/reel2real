/** Confirmed model ids. Do not print API keys. */
export const SPARK_MODEL_ID = "muse-spark-1.3";
export const SAM_MODEL_ID = "sam-3.1";
export const API_ORIGIN = "https://api.meta.ai";
export const RESPONSES_PATH = "/v1/responses";
export const RESPONSES_URL = `${API_ORIGIN}${RESPONSES_PATH}`;

/** Gate 0 reported medians. These are measurements from that run, not a live SLA. */
export const GATE0_REPORT = {
  stillMedianMs: 922,
  chunkMedianMs: 2213,
  decision: "pass_mvp" as const,
  liveMode: "keyframe_still" as const,
  sparkLatencyNote: "about 6–9 seconds",
};

export const DEFAULT_LIVE_MODE = "keyframe_still" as const;
