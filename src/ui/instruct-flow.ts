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

export function instructCameraBusyMessage(cause: unknown): string | null {
  const name = cause && typeof cause === "object" && "name" in cause ? String(cause.name) : "";
  return name === "NotReadableError" || name === "TrackStartError"
    ? "Close other apps or browser tabs using your camera, then retry the camera. You can also choose a recorded sample."
    : null;
}
