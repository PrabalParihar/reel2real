export const INSTRUCT_GOALS = [
  "Make a chai spice mix",
  "Pour latte art",
  "Fold an origami crane",
  "Plant seeds in a tray",
] as const;

export type InstructGoal = (typeof INSTRUCT_GOALS)[number];
export type InstructPrimary = "allow" | "capture" | "plan";

export function planStepsEnabled(goal: string, hasStill: boolean): boolean {
  return goal.trim().length > 0 && hasStill;
}

/** Section eyebrow on Instruction mode. The kicker style uppercases it. */
export const INSTRUCT_SECTION_LABEL = "Live coach";

/** A still can be grabbed only after a real frame is available. */
export const CAMERA_FRAME_TIMEOUT_MS = 8000;
export const CAMERA_STARTING_LABEL = "Camera starting…";
export const CAMERA_FAILED_HEADING = "Camera didn't start";
export const CAMERA_FAILED_COPY = "You can try again or watch a recorded Sample.";
export const CAMERA_DENIED_HEADING = "Camera access is blocked";
export const CAMERA_DENIED_COPY = "Allow camera access in your browser settings, then try again, or watch a recorded Sample.";
export const CAMERA_MISSING_HEADING = "No camera found";
export const CAMERA_MISSING_COPY = "No camera was found. Try again, or watch a recorded Sample.";
export const CAMERA_BUSY_HEADING = "Camera is in use";
export const CAMERA_BUSY_COPY = "Another app is using the camera. Close it, then try again, or watch a recorded Sample.";
export const CAMERA_INSECURE_HEADING = "Camera needs a secure page";
export const CAMERA_INSECURE_COPY = "Open this page with https, then try again, or watch a recorded Sample.";

export type InstructCameraFailure = "timeout" | "denied" | "missing" | "busy" | "insecure";

/** Permission and device errors fail immediately. Anything else uses the timeout copy. */
export function instructCameraFailure(error: unknown): InstructCameraFailure {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError") return "busy";
  if (name === "TypeError" || name === "InsecureContext") return "insecure";
  return "timeout";
}

export function instructCameraMessage(failure: InstructCameraFailure): { heading: string; body: string } {
  if (failure === "denied") return { heading: CAMERA_DENIED_HEADING, body: CAMERA_DENIED_COPY };
  if (failure === "missing") return { heading: CAMERA_MISSING_HEADING, body: CAMERA_MISSING_COPY };
  if (failure === "busy") return { heading: CAMERA_BUSY_HEADING, body: CAMERA_BUSY_COPY };
  if (failure === "insecure") return { heading: CAMERA_INSECURE_HEADING, body: CAMERA_INSECURE_COPY };
  return { heading: CAMERA_FAILED_HEADING, body: CAMERA_FAILED_COPY };
}

export function instructVideoReady(video: { readyState: number; videoWidth: number } | null | undefined): boolean {
  return Boolean(video && video.readyState >= 2 && video.videoWidth > 0);
}

/** Allow camera first, then capture. Plan is primary only when both pieces exist. */
export function instructPrimary(input: { cameraLive: boolean; hasStill: boolean; goal: string }): InstructPrimary {
  if (planStepsEnabled(input.goal, input.hasStill)) return "plan";
  if (input.cameraLive && !input.hasStill) return "capture";
  return "allow";
}

export function instructProgress(goal: string, hasStill: boolean): Array<{ id: "Goal" | "Still" | "Coach"; state: "done" | "current" | "wait" }> {
  const goalDone = goal.trim().length > 0;
  const stillDone = hasStill;
  return [
    { id: "Goal", state: goalDone ? "done" : "current" },
    { id: "Still", state: stillDone ? "done" : goalDone ? "current" : "wait" },
    { id: "Coach", state: goalDone && stillDone ? "current" : "wait" },
  ];
}
