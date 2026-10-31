import type { PreferredLiveMode, TutorialStep } from "@/src/schema/types";
import type { CoachStateId } from "./types";

export function honestyChip(mode: PreferredLiveMode, stillsArmed = false): string {
  if (stillsArmed || mode === "stills_only") return "Stills mode · Sample";
  if (mode === "chunk_video_1_2s") return "Chunk mode";
  return "Keyframe mode";
}

export function stateChip(state: CoachStateId): string | null {
  switch (state) {
    case "awaiting_camera":
      return "Camera";
    case "step_ready":
      return "Ready";
    case "waiting":
      return "Watching";
    case "tracking":
    case "evaluating":
      return "Checking…";
    case "success":
      return "Match";
    case "skip_detected":
      return "Skip";
    case "out_of_order":
      return "Out of order";
    case "safety_halt":
      return "Safety";
    case "mask_lost":
      return "Mask lost";
    case "retry":
      return "Retry";
    case "user_skip":
      return "Skipped";
    case "fallback_stills":
      return "Stills mode · Sample";
    case "error_recoverable":
      return "Retry";
    case "paused":
      return "Paused";
    case "tutorial_complete":
      return "Done";
    default:
      return null;
  }
}

export function missingObjectHint(step: TutorialStep, presence: Record<string, boolean> | null): string | null {
  const required = step.successCheck.requiredObjectIds?.length
    ? step.successCheck.requiredObjectIds
    : step.objects.filter((object) => object.role === "required_present").map((object) => object.objectId);
  const label = (id: string) => step.objects.find((object) => object.objectId === id)?.noun.replaceAll("_", " ") ?? id;
  if (!presence) {
    return `Keep these fully in frame: ${required.map(label).join(", ")}.`;
  }
  const missing = required.filter((id) => !presence[id]);
  if (!missing.length) return null;
  const names = missing.map(label);
  if (names.length === 1) return `${names[0]} isn't masked. Bring the whole object into frame.`;
  return `Not masked: ${names.join(", ")}. Frame each one fully.`;
}
