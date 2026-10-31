import type { TutorialStep } from "@/src/schema/types";
import type { CoachStateId } from "@/src/fsm/types";

const MAX = 80;

function clip(line: string): string {
  const clean = line.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX) return clean;
  return clean.slice(0, MAX - 1).trimEnd() + "…";
}

/** Thin spoken prompts. No question prompts and no back-and-forth. */
export function voiceLine(state: CoachStateId, step: TutorialStep | null): string | null {
  switch (state) {
    case "step_ready":
      return clip(step?.hinglishPrompt || "Step shuru.");
    case "success":
      return "Ho gaya.";
    case "skip_detected":
      return "Yeh step chhoot gaya.";
    case "out_of_order":
      return "Galat order. Is step pe wapas aao.";
    case "safety_halt":
      return clip(step?.safety?.message || "Ruko.");
    case "mask_lost":
      return "Phir se dikhao.";
    case "retry":
      return "Phir se.";
    case "tutorial_complete":
      return "Ho gaya.";
    default:
      return null;
  }
}
