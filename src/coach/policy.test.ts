import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SAMPLE_CHAI } from "@/src/server/fixtures";
import { capturePlan, promptsForStep } from "./prompts";
import { decideGate0 } from "@/src/gate0/decide";
import { publicRuntime } from "@/src/server/env";
import { redactSecrets } from "@/src/server/redact";

describe("coach policy", () => {
  it("defaults to a 1–2s keyframe still", () => {
    const plan = capturePlan("keyframe_still");
    expect(plan.inputKind).toBe("image");
    expect(plan.cadenceMs).toBeGreaterThanOrEqual(1000);
    expect(plan.cadenceMs).toBeLessThanOrEqual(2000);
    expect(plan.honesty).toBe("Keyframe mode");
    expect(capturePlan("stills_only").honesty).toBe("Stills mode · Sample");
    expect(capturePlan("chunk_video_1_2s").inputKind).toBe("video_chunk");
  });

  it("asks SAM for at most 4 objects and keeps a lookahead slot", () => {
    const prompts = promptsForStep(SAMPLE_CHAI, 0);
    expect(prompts.length).toBeLessThanOrEqual(4);
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.some((prompt) => prompt.lookahead)).toBe(true);
    expect(promptsForStep(SAMPLE_CHAI, 1).length).toBeLessThanOrEqual(4);
  });

  it("keeps Spark out of the coaching loop", () => {
    const coach = readFileSync("src/ui/useCoach.ts", "utf8");
    const segment = readFileSync("app/api/segment/route.ts", "utf8");
    expect(coach.includes("/api/spark")).toBe(false);
    expect(coach.includes("generateSteps")).toBe(false);
    expect(segment.includes("generateSteps")).toBe(false);
    expect(segment.includes("muse-spark")).toBe(false);
  });
});

describe("gate 0 decision", () => {
  const base = {
    sam_still_ok: true as boolean | null,
    sam_still_full_ms: 922,
    sam_clip_ok: true,
    sam_clip_full_ms: 2213,
    sam_clip_timed_out: false,
    sam_objects_returned: 3,
    spark_ok: true,
    spark_latency_ms: 7400,
    spark_json_parse_ok: true,
    spark_schema_valid: true,
    steps_count: 3,
  };

  it("folds the reported medians into keyframe-still pass_mvp", () => {
    const result = decideGate0([base, { ...base }, { ...base }], "live");
    expect(result.decision).toBe("pass_mvp");
    expect(result.liveMode).toBe("keyframe_still");
    expect(result.medianClipMs).toBe(2213);
    expect(result.medianStillMs).toBe(922);
  });

  it("uses the 2000 and 5000 boundaries", () => {
    expect(decideGate0([{ ...base, sam_clip_full_ms: 2000 }], "live").liveMode).toBe("keyframe_still");
    expect(decideGate0([{ ...base, sam_clip_full_ms: 2001 }], "live").liveMode).toBe("keyframe_still");
    expect(decideGate0([{ ...base, sam_clip_full_ms: 5000 }], "live").liveMode).toBe("keyframe_still");
    expect(decideGate0([{ ...base, sam_clip_full_ms: 5001 }], "live").decision).toBe("stills_only");
    expect(decideGate0([{ ...base, sam_clip_timed_out: true, sam_clip_full_ms: null, sam_clip_ok: false }], "live").decision).toBe("stills_only");
  });

  it("does not treat a mock run as a pass", () => {
    expect(decideGate0([{ ...base, sam_clip_full_ms: 30, sam_still_full_ms: 20 }], "mock").decision).toBe("unverified_mock");
  });

  it("escalates when Spark or the still path fails", () => {
    expect(decideGate0([{ ...base, spark_schema_valid: false }], "live").decision).toBe("nogo_escalate");
    expect(decideGate0([{ ...base, sam_clip_full_ms: 4000, sam_still_ok: false }], "live").decision).toBe("nogo_escalate");
  });
});

describe("secrets", () => {
  it("never returns the key from the public runtime", () => {
    const secret = "super-secret-value-not-for-logs";
    const runtime = publicRuntime({ META_DIRECT_ENABLED: "1", META_MODEL_API_KEY: secret, MODEL_API_KEY: "other-secret-value" });
    expect(runtime.mock).toBe(false);
    expect(JSON.stringify(runtime).includes(secret)).toBe(false);
    expect(redactSecrets(`Bearer ${secret} failed`, [secret]).includes(secret)).toBe(false);
  });
});
