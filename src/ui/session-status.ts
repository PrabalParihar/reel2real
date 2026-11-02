import type { StepsSource } from "./session";

/** Result provenance, never key/configuration presence, drives user-facing execution labels. */
export function sessionStatusLabel(input: {
  source: StepsSource | null;
  provenance: { mode: "live" | "mock" | "degraded" } | null;
  sampleRun: boolean;
}): "Live" | "Mock" | "Sample" | "Cached" | null {
  if (input.sampleRun || input.source === "sample" || input.source === "cap_sample") return "Sample";
  if (input.source === "cache" || input.source === "cap_cache") return "Cached";
  if (!input.source || !input.provenance || input.provenance.mode === "degraded") return null;
  return input.provenance.mode === "live" ? "Live" : "Mock";
}
