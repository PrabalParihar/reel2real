export const PHONE_STAND_HINT = "Prop your phone or laptop so the camera sees your workspace.";

export type InstructSamPhase = "waiting" | "box" | "failed";

export function instructHonestyChips(mock: boolean): { plan: string } {
  if (mock) return { plan: "Mock plan" };
  return { plan: "Live · muse-spark-1.3 plan" };
}

/** The SAM chip follows the highlight, not the plan. */
export function instructSamPhase(input: { failed: boolean; boxDrawn: boolean }): InstructSamPhase {
  if (input.failed) return "failed";
  if (input.boxDrawn) return "box";
  return "waiting";
}

export function instructSamChip(mock: boolean, phase: InstructSamPhase): string {
  if (phase === "failed") return "SAM unavailable";
  if (phase === "box") return mock ? "SAM box" : "Live · SAM box";
  return "Checking";
}
