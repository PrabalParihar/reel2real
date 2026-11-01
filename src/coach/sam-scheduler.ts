/**
 * Re-check cadence. One step is not one SAM call.
 * The coach leaves "waiting" on CADENCE_MS (1.5s), or immediately when the step
 * was just armed, and then sends one /api/segment. This scheduler also keeps
 * minIntervalMs (default 2s) between starts and will not start a second call
 * while one is in flight. A result that is not stable yet returns to waiting,
 * and the cadence fires again. Each /api/segment is one Meta SAM call per noun.
 * stepCap stops that loop on the current step. The session cap still applies
 * across steps.
 */
export const DEFAULT_SAM_MIN_INTERVAL_MS = 2000;
export const DEFAULT_SAM_SESSION_CAP = 60;
/** Segment requests per step, not Meta calls. Three nouns make 3 calls each. */
export const DEFAULT_SAM_STEP_CAP = 3;

export interface SamSchedulerConfig {
  minIntervalMs: number;
  sessionCap: number;
  stepCap: number;
}

export interface SamSchedulerState {
  inFlight: boolean;
  calls: number;
  stepCalls: number;
  lastStartedAt: number | null;
}

export type SamPauseReason = "hidden" | "step_done" | "error_recoverable" | "session_cap" | "step_cap";

export type SamPollDecision =
  | { action: "start"; state: SamSchedulerState }
  | { action: "wait"; reason: "in_flight" | "interval"; waitMs: number }
  | { action: "pause"; reason: SamPauseReason };

export function initialSamSchedulerState(): SamSchedulerState {
  return { inFlight: false, calls: 0, stepCalls: 0, lastStartedAt: null };
}

export function resetStepCalls(state: SamSchedulerState): SamSchedulerState {
  return { ...state, stepCalls: 0 };
}

/** Client hard stop. Once the per-session budget is spent, no more highlight calls. */
export function sessionBudgetHardStop(calls: number, sessionCap: number): boolean {
  return calls >= sessionCap;
}

/** Same honest degrade the coach already uses when highlights cannot be drawn. */
export const SESSION_BUDGET_STOP_LABEL = "Highlights unavailable";

export function readSamSchedulerConfig(env: Record<string, string | undefined> = {}): SamSchedulerConfig {
  return {
    minIntervalMs: positiveInt(env.NEXT_PUBLIC_SAM_MIN_INTERVAL_MS, DEFAULT_SAM_MIN_INTERVAL_MS),
    sessionCap: positiveInt(env.NEXT_PUBLIC_SAM_SESSION_CAP, DEFAULT_SAM_SESSION_CAP),
    stepCap: positiveInt(env.NEXT_PUBLIC_SAM_STEP_CAP, DEFAULT_SAM_STEP_CAP),
  };
}

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function markSamSettled(state: SamSchedulerState): SamSchedulerState {
  return { ...state, inFlight: false };
}

export function decideSamPoll(input: {
  now: number;
  state: SamSchedulerState;
  hidden: boolean;
  stepDone: boolean;
  coachState: string;
  config: SamSchedulerConfig;
}): SamPollDecision {
  if (input.state.inFlight) return { action: "wait", reason: "in_flight", waitMs: input.config.minIntervalMs };
  if (input.state.calls >= input.config.sessionCap) return { action: "pause", reason: "session_cap" };
  if (input.state.stepCalls >= input.config.stepCap) return { action: "pause", reason: "step_cap" };
  if (input.hidden) return { action: "pause", reason: "hidden" };
  if (input.coachState === "error_recoverable") return { action: "pause", reason: "error_recoverable" };
  if (input.stepDone) return { action: "pause", reason: "step_done" };
  if (input.state.lastStartedAt != null) {
    const elapsed = input.now - input.state.lastStartedAt;
    if (elapsed < input.config.minIntervalMs) {
      return { action: "wait", reason: "interval", waitMs: input.config.minIntervalMs - elapsed };
    }
  }
  return {
    action: "start",
    state: {
      inFlight: true,
      calls: input.state.calls + 1,
      stepCalls: input.state.stepCalls + 1,
      lastStartedAt: input.now,
    },
  };
}
