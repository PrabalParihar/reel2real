export const DEFAULT_SAM_MIN_INTERVAL_MS = 2000;
export const DEFAULT_SAM_SESSION_CAP = 60;

export interface SamSchedulerConfig {
  minIntervalMs: number;
  sessionCap: number;
}

export interface SamSchedulerState {
  inFlight: boolean;
  calls: number;
  lastStartedAt: number | null;
}

export type SamPauseReason = "hidden" | "step_done" | "error_recoverable" | "session_cap";

export type SamPollDecision =
  | { action: "start"; state: SamSchedulerState }
  | { action: "wait"; reason: "in_flight" | "interval"; waitMs: number }
  | { action: "pause"; reason: SamPauseReason };

export function initialSamSchedulerState(): SamSchedulerState {
  return { inFlight: false, calls: 0, lastStartedAt: null };
}

export function readSamSchedulerConfig(env: Record<string, string | undefined> = {}): SamSchedulerConfig {
  return {
    minIntervalMs: positiveInt(env.NEXT_PUBLIC_SAM_MIN_INTERVAL_MS, DEFAULT_SAM_MIN_INTERVAL_MS),
    sessionCap: positiveInt(env.NEXT_PUBLIC_SAM_SESSION_CAP, DEFAULT_SAM_SESSION_CAP),
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
      lastStartedAt: input.now,
    },
  };
}
