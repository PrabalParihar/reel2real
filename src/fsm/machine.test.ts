import { describe, expect, it } from "vitest";
import { SAMPLE_ALOO, SAMPLE_CHAI } from "@/src/server/fixtures";
import { coachHonesty, coachStatusChip, headerChip, highlightsChip, honestyChip, missingObjectHint, stateChip } from "./ui";
import { evaluateCheck } from "./evaluate";
import { createCoach, transition } from "./machine";
import { TIMEOUTS } from "./types";
import type { MachineState } from "./types";
import { voiceLine } from "@/src/voice/lines";

function boot(): MachineState {
  let machine = createCoach(SAMPLE_CHAI);
  machine = transition(machine, { type: "START_COACH" }, SAMPLE_CHAI).machine;
  machine = transition(machine, { type: "CAMERA_GRANTED" }, SAMPLE_CHAI).machine;
  return transition(machine, { type: "READY" }, SAMPLE_CHAI).machine;
}

function check(machine: MachineState, presence: Record<string, boolean>) {
  const tracking = transition(machine, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
  return transition(tracking, { type: "SAM_RESULT", presence }, SAMPLE_CHAI).machine;
}

describe("step fsm", () => {
  it("walks idle to waiting and keeps the proposed cadence", () => {
    const machine = boot();
    expect(machine.state).toBe("waiting");
    expect(machine.context.liveMode).toBe("keyframe_still");
    expect(TIMEOUTS.CADENCE_MS).toBeGreaterThanOrEqual(1000);
    expect(TIMEOUTS.CADENCE_MS).toBeLessThanOrEqual(2000);
    expect(TIMEOUTS.SAM_TIMEOUT_MS).toBe(8000);
  });

  it("does not advance when a required object is skipped", () => {
    let machine = boot();
    const absent = { obj_mortar: false, obj_pestle: false };
    machine = check(machine, absent);
    machine = check(machine, absent);
    expect(machine.state).not.toBe("skip_detected");
    machine = check(machine, absent);
    expect(machine.state).toBe("skip_detected");
    expect(machine.context.stepIndex).toBe(0);
    const skipped = transition(machine, { type: "USER_SKIP" }, SAMPLE_CHAI);
    expect(skipped.trail).toContain("user_skip");
    expect(skipped.machine.context.stepIndex).toBe(1);
    expect(skipped.machine.context.skippedStepIds).toHaveLength(1);
  });

  it("reaches success without changing step until Next", () => {
    const machine = check(boot(), { obj_mortar: true, obj_pestle: true });
    expect(machine.state).toBe("success");
    expect(machine.context.stepIndex).toBe(0);
    const next = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(next.state).toBe("step_ready");
    expect(next.context.stepIndex).toBe(1);
  });

  it("prioritises safety, then out of order", () => {
    let machine = createCoach(SAMPLE_ALOO);
    machine = transition(machine, { type: "START_COACH" }, SAMPLE_ALOO).machine;
    machine = transition(machine, { type: "CAMERA_GRANTED" }, SAMPLE_ALOO).machine;
    machine = transition(machine, { type: "READY" }, SAMPLE_ALOO).machine;
    machine = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_ALOO).machine;
    machine = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_ALOO).machine;
    machine = transition(machine, { type: "READY" }, SAMPLE_ALOO).machine;
    const tracking = transition(machine, { type: "CADENCE_TICK" }, SAMPLE_ALOO).machine;
    machine = transition(tracking, { type: "SAM_RESULT", presence: { obj_onion_pieces: true, obj_board: true, obj_knife: true } }, SAMPLE_ALOO).machine;
    expect(machine.state).toBe("safety_halt");
    expect(machine.context.stepIndex).toBe(2);
    const retried = transition(machine, { type: "USER_RETRY" }, SAMPLE_ALOO);
    expect(retried.trail).toContain("retry");
    expect(retried.machine.state).toBe("waiting");
  });

  it("advances on Next from error_recoverable without a SAM result", () => {
    let machine = boot();
    machine = transition(machine, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
    expect(machine.state).toBe("tracking");
    const moved = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(moved.context.stepIndex).toBe(1);
    expect(moved.state).toBe("step_ready");

    machine = boot();
    for (let attempt = 0; attempt < TIMEOUTS.ERROR_AUTO_RETRY; attempt += 1) {
      machine = transition(machine, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
      expect(machine.state).toBe("tracking");
      machine = transition(machine, { type: "SAM_ERROR", message: "SAM failed (HTTP 404)." }, SAMPLE_CHAI).machine;
      expect(machine.state).toBe("waiting");
    }
    machine = transition(machine, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
    machine = transition(machine, { type: "SAM_ERROR", message: "SAM failed (HTTP 404)." }, SAMPLE_CHAI).machine;
    expect(machine.state).toBe("error_recoverable");
    expect(highlightsChip(machine.context.lastError)).toBe("Highlights unavailable");
    const next = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(next.state).toBe("step_ready");
    expect(next.context.stepIndex).toBe(1);
    const skipped = transition(machine, { type: "USER_SKIP" }, SAMPLE_CHAI).machine;
    expect(skipped.context.stepIndex).toBe(1);
    expect(skipped.context.skippedStepIds).toHaveLength(1);
  });

  it("lets Skip and Next leave out of order without another SAM result", () => {
    let machine = boot();
    const early = { obj_mortar: false, obj_pestle: false, obj_hand: true };
    machine = check(machine, early);
    machine = check(machine, early);
    expect(machine.state).toBe("out_of_order");
    const next = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(next.context.stepIndex).toBe(1);
    expect(next.state).toBe("step_ready");
    const skipped = transition(machine, { type: "USER_SKIP" }, SAMPLE_CHAI).machine;
    expect(skipped.context.skippedStepIds).toHaveLength(1);
  });

  it("flags out of order before a silent advance", () => {
    let machine = boot();
    const early = { obj_mortar: false, obj_pestle: false, obj_hand: true };
    machine = check(machine, early);
    expect(machine.state).toBe("waiting");
    machine = check(machine, early);
    expect(machine.state).toBe("out_of_order");
    expect(machine.context.stepIndex).toBe(0);
  });

  it("arms stills mode and returns to waiting", () => {
    const result = transition(boot(), { type: "ENTER_STILLS_FALLBACK" }, SAMPLE_CHAI);
    expect(result.trail).toContain("fallback_stills");
    expect(result.machine.state).toBe("waiting");
    expect(result.machine.context.stillsArmed).toBe(true);
    expect(honestyChip(result.machine.context.liveMode, true)).toBe("Stills mode · Sample");
  });

  it("labels keyframe mode and the checking chip", () => {
    expect(honestyChip("keyframe_still")).toBe("Keyframe mode");
    expect(coachHonesty("keyframe_still", false, true)).toBe("Keyframe stills · Sample steps");
    expect(honestyChip("chunk_video_1_2s")).toBe("Chunk mode");
    expect(stateChip("tracking")).toBe("Checking…");
    expect(stateChip("skip_detected")).toBe("Skip");
    expect(stateChip("safety_halt")).toBe("Safety");
  });

  it("tells the cook when an expected object is not highlighted", () => {
    const step = SAMPLE_CHAI.steps[2];
    const hint = missingObjectHint(step, { obj_spices: false });
    expect(hint).toMatch(/spices/i);
    expect(hint).toMatch(/highlighted/i);
    expect(hint?.toLowerCase().includes("mask")).toBe(false);
    expect(missingObjectHint(step, { obj_spices: true })).toBeNull();
    expect(missingObjectHint({ ...step, objects: [], successCheck: { ...step.successCheck, requiredObjectIds: [] } }, null)).toMatch(/No highlight/i);
    expect(stateChip("mask_lost")).toBe("Highlight lost");
    expect(coachStatusChip("tracking", true)).toBe("Manual, press Next");
    expect(coachStatusChip("tracking", false)).toBe("Checking…");
    expect(headerChip({ mock: false, sampleRun: true, liveClip: false })).toBe("Sample");
    expect(headerChip({ mock: false, sampleRun: false, liveClip: true })).toBe("Live");
    expect(headerChip({ mock: true, sampleRun: false, liveClip: true })).toBeNull();
    expect(headerChip({ mock: true, sampleRun: false, liveClip: false })).toBeNull();
  });

  it("keeps voice lines short and free of questions", () => {
    for (const step of SAMPLE_CHAI.steps) {
      for (const state of ["step_ready", "success", "skip_detected", "safety_halt", "tracking"] as const) {
        const line = voiceLine(state, step);
        if (line) {
          expect(line.length).toBeLessThanOrEqual(80);
          expect(line.includes("?")).toBe(false);
        }
      }
    }
    expect(voiceLine("tracking", SAMPLE_CHAI.steps[0])).toBeNull();
  });
});

describe("evaluate priority", () => {
  it("lets safety beat skip, mask loss, and success", () => {
    const step = SAMPLE_ALOO.steps[2];
    const result = evaluateCheck({
      step,
      laterObjectIds: [],
      presence: { obj_onion_pieces: false, obj_board: false, obj_knife: true },
      counters: { stableHits: 2, skipDwell: 3, oooDwell: 2, maskMisses: { obj_onion_pieces: 3 }, lockedObjectIds: ["obj_onion_pieces"] },
    });
    expect(result.signal?.type).toBe("SAFETY_SIGNAL");
  });
});
