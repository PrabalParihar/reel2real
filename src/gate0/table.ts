import type { GateDecisionResult, GateRun } from "./decide";

const METRICS = [
  "sam_still_ok",
  "sam_still_ttfm_ms",
  "sam_clip_ok",
  "sam_clip_ttfm_ms",
  "sam_objects_returned",
  "spark_ok",
  "spark_latency_ms",
  "spark_json_parse_ok",
  "spark_schema_valid",
  "steps_count",
] as const;

function cell(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export function formatGateTable(runs: GateRun[], decision: GateDecisionResult, mode: "live" | "mock"): string {
  const header = ["metric", ...runs.map((_, index) => `run_${index + 1}`), "notes"];
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const metric of METRICS) {
    const values = runs.map((run) => cell(run[metric]));
    lines.push(`| ${metric} | ${values.join(" | ")} | ${mode} |`);
  }
  lines.push(`| decision | ${decision.decision} | ${decision.liveMode} | ${decision.reason} |`);
  return lines.join("\n");
}
