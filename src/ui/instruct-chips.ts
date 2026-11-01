export const PHONE_STAND_HINT = "Prop your phone or laptop so the camera sees your workspace.";

export type InstructSamPhase = "waiting" | "box" | "stale" | "failed";

export interface SamViewState {
  boxDrawn: boolean;
  failed: boolean;
}

export function instructHonestyChips(mock: boolean): { plan: string } {
  if (mock) return { plan: "Mock plan" };
  return { plan: "Live · muse-spark-1.3 plan" };
}

/**
 * A later failure keeps the last good boxes. Unavailable is only for a miss
 * with nothing left on screen.
 */
export function nextSamView(state: SamViewState, event: "success" | "failure"): SamViewState {
  if (event === "success") return { boxDrawn: true, failed: false };
  if (state.boxDrawn) return { boxDrawn: true, failed: true };
  return { boxDrawn: false, failed: true };
}

/** The SAM chip follows the highlight, not the plan. */
export function instructSamPhase(input: { failed: boolean; boxDrawn: boolean }): InstructSamPhase {
  if (input.failed && input.boxDrawn) return "stale";
  if (input.failed) return "failed";
  if (input.boxDrawn) return "box";
  return "waiting";
}

export function instructSamChip(mock: boolean, phase: InstructSamPhase): string {
  if (phase === "failed") return "SAM unavailable";
  if (phase === "stale") return "Last check";
  if (phase === "box") return mock ? "SAM box" : "Live · SAM box";
  return "Checking";
}

export function instructSamOverlay(phase: InstructSamPhase, liveLabel: string | null): string | null {
  if (phase === "failed") return "Highlights unavailable";
  if (phase === "stale") return "Last check";
  return liveLabel;
}
