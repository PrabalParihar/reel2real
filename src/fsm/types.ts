import type { PreferredLiveMode } from "@/src/schema/types";

export const COACH_STATES = [
  "idle",
  "awaiting_camera",
  "step_ready",
  "waiting",
  "tracking",
  "evaluating",
  "success",
  "skip_detected",
  "out_of_order",
  "safety_halt",
  "mask_lost",
  "retry",
  "user_skip",
  "fallback_stills",
  "error_recoverable",
  "tutorial_complete",
  "paused",
] as const;

export type CoachStateId = (typeof COACH_STATES)[number];
export type StepOutcome = "unvisited" | "manual_confirmed" | "objects_visible" | "skipped";

export interface CoachContext {
  stepIndex: number;
  stepCount: number;
  stepIds: string[];
  stepOutcomes: Record<string, StepOutcome>;
  liveMode: PreferredLiveMode;
  stillsArmed: boolean;
  stableHits: number;
  skipDwell: number;
  oooDwell: number;
  maskMisses: Record<string, number>;
  lockedObjectIds: string[];
  autoRetries: number;
  lastError?: string;
  skippedStepIds: string[];
  safetyHits: number;
  explicitAdvances: number;
  armImmediate: boolean;
  tick: number;
}

export interface MachineState {
  state: CoachStateId;
  context: CoachContext;
}

export type Signal =
  | { type: "SUCCESS_STABLE" }
  | { type: "SKIP_SIGNAL"; missingObjectIds: string[] }
  | { type: "OUT_OF_ORDER_SIGNAL"; unexpectedObjectIds: string[] }
  | { type: "SAFETY_SIGNAL"; ruleId: string; message: string }
  | { type: "MASK_LOST_SIGNAL"; objectIds: string[] };

export type CoachEvent =
  | { type: "START_COACH" }
  | { type: "CAMERA_GRANTED" }
  | { type: "CAMERA_DENIED" }
  | { type: "READY" }
  | { type: "CADENCE_TICK" }
  | { type: "CHUNK_CAPTURED" }
  | { type: "SAM_RESULT"; presence: Record<string, boolean>; stepIndex?: number; tick?: number }
  | { type: "SAM_TIMEOUT"; stepIndex?: number; tick?: number }
  | { type: "SAM_ERROR"; message: string; stepIndex?: number; tick?: number }
  | Signal
  | { type: "USER_RETRY" }
  | { type: "USER_SKIP" }
  | { type: "USER_ADVANCE" }
  | { type: "JUMP_TO_STEP"; index: number }
  | { type: "USER_PAUSE" }
  | { type: "USER_RESUME" }
  | { type: "ENTER_STILLS_FALLBACK"; reason?: string }
  | { type: "SET_LIVE_MODE"; mode: PreferredLiveMode }
  | { type: "STEP_LOADED" }
  | { type: "ALL_STEPS_DONE" }
  | { type: "AUTO_RETRY" };

export const TIMEOUTS = {
  CADENCE_MS: 1500,
  CADENCE_MIN_MS: 1000,
  CADENCE_MAX_MS: 2000,
  SAM_TIMEOUT_MS: 8000,
  MASK_LOST_CHUNKS: 2,
  SKIP_DWELL_CHUNKS: 3,
  OOO_CONFIRM_CHUNKS: 2,
  ERROR_AUTO_RETRY: 2,
} as const;
