import type { PreferredLiveMode, TutorialStep } from "@/src/schema/types";
import { uniqueNames } from "@/src/samples/scene";
import type { CoachStateId } from "./types";

export function honestyChip(mode: PreferredLiveMode, stillsArmed = false): string {
  if (stillsArmed || mode === "stills_only") return "Stills mode · Sample";
  if (mode === "chunk_video_1_2s") return "Chunk mode";
  return "Keyframe mode";
}

export function coachHonesty(mode: PreferredLiveMode, stillsArmed: boolean, sampleSteps: boolean): string {
  const base = stillsArmed || mode === "stills_only" ? "Stills mode" : mode === "chunk_video_1_2s" ? "Chunk mode" : "Keyframe stills";
  return sampleSteps ? `${base} · Sample steps` : `${base} · Steps from clip`;
}

export function highlightsChip(lastError?: string): string | null {
  if (!lastError || lastError === "camera_denied") return null;
  return "Highlights unavailable";
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
      return "Highlight lost";
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
  if (!required.length) return "No highlight on this frame. Press Next when the step looks right.";
  if (!presence) {
    return `Keep these fully in frame: ${uniqueNames(required.map(label)).join(", ")}.`;
  }
  const missing = required.filter((id) => !presence[id]);
  if (!missing.length) return null;
  const names = uniqueNames(missing.map(label));
  if (names.length === 1) return `${names[0]} isn't highlighted. Bring the whole object into frame.`;
  return `Not highlighted: ${names.join(", ")}. Frame each one fully.`;
}

export function coachStatusChip(state: CoachStateId, cameraBlocked: boolean): string | null {
  if (cameraBlocked) return "Manual, press Next";
  return stateChip(state);
}

/** Hide the step-panel still when the stage is already showing that Sample frame. */
export function showStepPanelFrame(stageShowsRecordedSample: boolean): boolean {
  return !stageShowsRecordedSample;
}

/** Live only for a real uploaded clip on the live runtime. Sample runs stay Sample. */
export function headerChip(input: { mock: boolean; sampleRun: boolean; liveClip: boolean }): "Live" | "Sample" | null {
  if (input.sampleRun) return "Sample";
  if (!input.mock && input.liveClip) return "Live";
  return null;
}
