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
