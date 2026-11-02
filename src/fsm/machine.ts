import type { PreferredLiveMode, TutorialSteps } from "@/src/schema/types";
import { DEFAULT_LIVE_MODE } from "@/src/models";
import { evaluateCheck } from "./evaluate";
import { TIMEOUTS, type CoachContext, type CoachEvent, type CoachStateId, type MachineState } from "./types";

export interface TransitionResult {
  machine: MachineState;
  trail: CoachStateId[];
}

function emptyContext(stepCount: number, liveMode: PreferredLiveMode): CoachContext {
  return {
    stepIndex: 0,
    stepCount,
    liveMode,
    stillsArmed: liveMode === "stills_only",
    stableHits: 0,
    skipDwell: 0,
    oooDwell: 0,
    maskMisses: {},
    lockedObjectIds: [],
    autoRetries: 0,
    skippedStepIds: [],
    safetyHits: 0,
    explicitAdvances: 0,
    armImmediate: false,
    tick: 0,
  };
}

export function createCoach(tutorial: TutorialSteps): MachineState {
  const liveMode = tutorial.runtimeHints?.preferredLiveMode ?? DEFAULT_LIVE_MODE;
  return { state: "idle", context: emptyContext(tutorial.steps.length, liveMode) };
}

function clearSoft(context: CoachContext, extra: Partial<CoachContext> = {}): CoachContext {
  return {
    ...context,
    stableHits: 0,
    skipDwell: 0,
    oooDwell: 0,
    maskMisses: {},
    lockedObjectIds: [],
    lastError: undefined,
    armImmediate: true,
    tick: context.tick + 1,
    ...extra,
  };
}

function advance(context: CoachContext, asSkip: boolean): MachineState {
  const skippedStepIds = asSkip
    ? [...context.skippedStepIds, `index:${context.stepIndex}`]
    : context.skippedStepIds;
  const nextIndex = context.stepIndex + 1;
  if (nextIndex >= context.stepCount) {
    return {
      state: "tutorial_complete",
      context: { ...context, skippedStepIds, armImmediate: false },
    };
  }
  return {
    state: "step_ready",
    context: clearSoft(
      { ...context, skippedStepIds, explicitAdvances: context.explicitAdvances + (asSkip ? 0 : 1) },
      { stepIndex: nextIndex, armImmediate: false, tick: context.tick + 1 },
    ),
  };
}

function settle(machine: MachineState, trail: CoachStateId[]): MachineState {
  if (machine.state === "retry") {
    const next: MachineState = { state: "waiting", context: clearSoft(machine.context) };
    trail.push(next.state);
    return next;
  }
  if (machine.state === "user_skip") {
    const next = advance(machine.context, true);
    trail.push(next.state);
    return next;
  }
  if (machine.state === "fallback_stills") {
    const next: MachineState = {
      state: "waiting",
      context: {
        ...machine.context,
        liveMode: "stills_only",
        stillsArmed: true,
        armImmediate: true,
        tick: machine.context.tick + 1,
      },
    };
    trail.push(next.state);
    return next;
  }
  return machine;
}

function same(machine: MachineState): TransitionResult {
  return { machine, trail: [machine.state] };
}

export function transition(machine: MachineState, event: CoachEvent, tutorial?: TutorialSteps): TransitionResult {
  const { state, context } = machine;
  let next: MachineState | null = null;

  switch (event.type) {
    case "START_COACH":
      if (state === "idle") next = { state: "awaiting_camera", context };
      break;
    case "CAMERA_GRANTED":
      if (state === "awaiting_camera") {
        next = { state: "step_ready", context: { ...context, lastError: undefined, stepIndex: 0 } };
      }
      break;
    case "CAMERA_DENIED":
      if (state === "awaiting_camera") {
        next = { state: "error_recoverable", context: { ...context, lastError: "camera_denied" } };
      }
      break;
    case "READY":
    case "CADENCE_TICK":
      if (state === "step_ready") {
        next = { state: "waiting", context: { ...context, armImmediate: true, tick: context.tick + 1 } };
      } else if (state === "waiting" && event.type === "CADENCE_TICK") {
        next = { state: "tracking", context: { ...context, armImmediate: false } };
      } else if (state === "mask_lost" && event.type === "CADENCE_TICK") {
        next = { state: "tracking", context };
      }
      break;
    case "CHUNK_CAPTURED":
      if (state === "waiting" || state === "tracking") next = { state: "tracking", context };
      break;
    case "SAM_RESULT":
      if (state === "tracking" && tutorial) {
        const step = tutorial.steps[context.stepIndex];
        const laterObjectIds = tutorial.steps
          .slice(context.stepIndex + 1)
          .flatMap((item) => item.objects.map((object) => object.objectId));
        const evaluation = evaluateCheck({
          step,
          laterObjectIds,
          presence: event.presence,
          counters: {
            stableHits: context.stableHits,
            skipDwell: context.skipDwell,
            oooDwell: context.oooDwell,
            maskMisses: context.maskMisses,
            lockedObjectIds: context.lockedObjectIds,
          },
        });
        const withCounters: MachineState = {
          state: "evaluating",
          context: { ...context, ...evaluation.counters, lastError: undefined },
        };
        if (!evaluation.signal) {
          next = { state: "waiting", context: { ...withCounters.context, tick: context.tick + 1 } };
        } else if (evaluation.signal.type === "SAFETY_SIGNAL") {
          next = {
            state: "safety_halt",
            context: { ...withCounters.context, safetyHits: context.safetyHits + 1, lastError: evaluation.signal.message },
          };
        } else if (evaluation.signal.type === "OUT_OF_ORDER_SIGNAL") {
          next = { state: "out_of_order", context: withCounters.context };
        } else if (evaluation.signal.type === "SKIP_SIGNAL") {
          next = { state: "skip_detected", context: withCounters.context };
        } else if (evaluation.signal.type === "MASK_LOST_SIGNAL") {
          next = { state: "mask_lost", context: withCounters.context };
        } else {
          next = { state: "success", context: withCounters.context };
        }
      }
      break;
    case "SAM_TIMEOUT":
    case "SAM_ERROR":
      if (state === "tracking") {
        const message = event.type === "SAM_TIMEOUT" ? "SAM timed out. Retry this step." : event.message;
        if (context.autoRetries < TIMEOUTS.ERROR_AUTO_RETRY) {
          next = {
            state: "waiting",
            context: clearSoft(context, {
              autoRetries: context.autoRetries + 1,
              lastError: message,
            }),
          };
        } else {
          next = { state: "error_recoverable", context: { ...context, lastError: message } };
        }
      }
      break;
    case "SUCCESS_STABLE":
      if (state === "evaluating") next = { state: "success", context };
      break;
    case "SAFETY_SIGNAL":
      if (state === "evaluating") {
        next = { state: "safety_halt", context: { ...context, safetyHits: context.safetyHits + 1, lastError: event.message } };
      }
      break;
    case "OUT_OF_ORDER_SIGNAL":
      if (state === "evaluating") next = { state: "out_of_order", context };
      break;
    case "SKIP_SIGNAL":
      if (state === "evaluating") next = { state: "skip_detected", context };
      break;
    case "MASK_LOST_SIGNAL":
      if (state === "evaluating") next = { state: "mask_lost", context };
      break;
    case "USER_RETRY":
      if (state === "skip_detected" || state === "out_of_order" || state === "mask_lost" || state === "safety_halt") {
        next = { state: "retry", context };
      } else if (state === "error_recoverable") {
        next = context.lastError === "camera_denied"
          ? { state: "awaiting_camera", context: { ...context, autoRetries: 0, lastError: undefined } }
          : { state: "waiting", context: clearSoft(context, { autoRetries: 0 }) };
      }
      break;
    case "USER_SKIP":
      if (state === "skip_detected" || state === "step_ready" || state === "waiting" || state === "mask_lost" || state === "out_of_order" || state === "success" || state === "tracking" || state === "evaluating" || state === "error_recoverable") {
        next = { state: "user_skip", context };
      }
      break;
    case "JUMP_TO_STEP": {
      const index = event.index;
      const canJump = state === "step_ready"
        || state === "waiting"
        || state === "tracking"
        || state === "evaluating"
        || state === "success"
        || state === "skip_detected"
        || state === "out_of_order"
        || state === "mask_lost"
        || state === "error_recoverable"
        || state === "paused";
      if (!canJump || !Number.isInteger(index) || index < 0 || index >= context.stepCount || index === context.stepIndex) break;
      next = {
        state: "step_ready",
        context: clearSoft(context, { stepIndex: index, armImmediate: false, tick: context.tick + 1 }),
      };
      break;
    }
    case "USER_ADVANCE":
    case "STEP_LOADED":
      if (state === "skip_detected") {
        next = { state: "user_skip", context };
      } else if (state === "success" || state === "step_ready" || state === "waiting" || state === "out_of_order" || state === "mask_lost" || state === "tracking" || state === "evaluating" || state === "error_recoverable") {
        next = advance(context, false);
      }
      break;
    case "ALL_STEPS_DONE":
      if (state === "success") next = { state: "tutorial_complete", context };
      break;
    case "USER_PAUSE":
      if (state === "waiting" || state === "step_ready") next = { state: "paused", context: { ...context, armImmediate: false } };
      break;
    case "USER_RESUME":
      if (state === "paused") next = { state: "waiting", context: { ...context, armImmediate: false, tick: context.tick + 1 } };
      break;
    case "ENTER_STILLS_FALLBACK":
      if (state === "waiting" || state === "step_ready") next = { state: "fallback_stills", context };
      break;
    case "SET_LIVE_MODE":
      if (state === "waiting" || state === "step_ready" || state === "paused") {
        if (event.mode === "stills_only") next = { state: "fallback_stills", context };
        else next = { state, context: { ...context, liveMode: event.mode, stillsArmed: false } };
      }
      break;
    case "AUTO_RETRY":
      if (state === "error_recoverable" && context.autoRetries < TIMEOUTS.ERROR_AUTO_RETRY && context.lastError !== "camera_denied") {
        next = { state: "waiting", context: clearSoft(context, { autoRetries: context.autoRetries + 1 }) };
      }
      break;
    default:
      break;
  }

  if (!next || (next.state === state && next.context === context)) return same(machine);
  const trail: CoachStateId[] = [state];
  if (event.type === "SAM_RESULT" && state === "tracking" && next.state !== "tracking") {
    trail.push("evaluating");
  }
  if (event.type === "SAM_TIMEOUT" || event.type === "SAM_ERROR") {
    if (next.state === "waiting") trail.push("error_recoverable");
  }
  trail.push(next.state);
  const settled = settle(next, trail);
  return { machine: settled, trail };
}

export { TIMEOUTS };
