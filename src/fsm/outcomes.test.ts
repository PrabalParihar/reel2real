import { describe, expect, it } from "vitest";
import { SAMPLE_ALOO, SAMPLE_CHAI } from "@/src/server/fixtures";
import { createCoach, transition } from "./machine";
import type { CoachEvent } from "./types";

function boot() {
  let machine = createCoach(SAMPLE_CHAI);
  for (const type of ["START_COACH", "CAMERA_GRANTED", "READY"] as const) machine = transition(machine, { type }, SAMPLE_CHAI).machine;
  return machine;
}

describe("honest step outcomes", () => {
  it("keeps jumped-over steps unvisited after finishing the last step", () => {
    let machine = transition(boot(), { type: "JUMP_TO_STEP", index: SAMPLE_CHAI.steps.length - 1 }, SAMPLE_CHAI).machine;
    machine = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(machine.state).toBe("tutorial_complete");
    expect(machine.context.stepOutcomes[SAMPLE_CHAI.steps[0].id]).toBe("unvisited");
    expect(machine.context.stepOutcomes[SAMPLE_CHAI.steps.at(-1)!.id]).toBe("manual_confirmed");
  });

  it("counts a revisited skip once and replaces it after manual confirmation", () => {
    let machine = transition(boot(), { type: "USER_SKIP" }, SAMPLE_CHAI).machine;
    machine = transition(machine, { type: "JUMP_TO_STEP", index: 0 }, SAMPLE_CHAI).machine;
    machine = transition(machine, { type: "USER_SKIP" }, SAMPLE_CHAI).machine;
    expect(machine.context.skippedStepIds).toEqual(["index:0"]);
    machine = transition(machine, { type: "JUMP_TO_STEP", index: 0 }, SAMPLE_CHAI).machine;
    machine = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(machine.context.skippedStepIds).toEqual([]);
    expect(machine.context.stepOutcomes[SAMPLE_CHAI.steps[0].id]).toBe("manual_confirmed");
  });

  it("records object visibility separately from manually continued steps", () => {
    let machine = transition(boot(), { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
    machine = transition(machine, { type: "SAM_RESULT", presence: { obj_mortar: true, obj_pestle: true } }, SAMPLE_CHAI).machine;
    expect(machine.state).toBe("success");
    expect(machine.context.stepOutcomes[SAMPLE_CHAI.steps[0].id]).toBe("objects_visible");
    machine = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(machine.context.stepOutcomes[SAMPLE_CHAI.steps[0].id]).toBe("objects_visible");
  });

  it("rechecks an exhausted waiting or successful step without advancing", () => {
    const waiting = boot();
    const rechecked = transition(waiting, { type: "USER_RETRY" }, SAMPLE_CHAI).machine;
    expect(rechecked.context.tick).toBeGreaterThan(waiting.context.tick);
    expect(rechecked.context.stepIndex).toBe(0);
    let success = transition(waiting, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
    success = transition(success, { type: "SAM_RESULT", presence: { obj_mortar: true, obj_pestle: true } }, SAMPLE_CHAI).machine;
    expect(transition(success, { type: "USER_RETRY" }, SAMPLE_CHAI).machine.state).toBe("waiting");
  });

  it("normalizes an unsupported client chunk hint to a still check", () => {
    const tutorial = { ...SAMPLE_CHAI, runtimeHints: { ...SAMPLE_CHAI.runtimeHints, preferredLiveMode: "chunk_video_1_2s" as const } };
    expect(createCoach(tutorial).context.liveMode).toBe("keyframe_still");
  });

  it("preserves targeted safety blocks for Next, Skip and jumps", () => {
    const machine = { ...createCoach(SAMPLE_ALOO), state: "safety_halt" as const };
    for (const event of [{ type: "USER_ADVANCE" }, { type: "USER_SKIP" }, { type: "JUMP_TO_STEP", index: 1 }] as CoachEvent[]) {
      expect(transition(machine, event, SAMPLE_ALOO).machine).toEqual(machine);
    }
  });
});

describe("obsolete segment results", () => {
  it("ignores results and timeouts stamped for a previous step", () => {
    const first = boot();
    let next = transition(first, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    next = transition(next, { type: "READY" }, SAMPLE_CHAI).machine;
    next = transition(next, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
    for (const event of [
      { type: "SAM_RESULT", presence: { obj_hand: true }, stepIndex: 0, tick: first.context.tick },
      { type: "SAM_TIMEOUT", stepIndex: 0, tick: first.context.tick },
    ] as CoachEvent[]) expect(transition(next, event, SAMPLE_CHAI).machine).toEqual(next);
  });

  it("records Next after a missing-object warning as learner confirmation", () => {
    let machine = boot();
    for (let i = 0; i < 3; i++) {
      machine = transition(machine, { type: "CADENCE_TICK" }, SAMPLE_CHAI).machine;
      machine = transition(machine, { type: "SAM_RESULT", presence: {} }, SAMPLE_CHAI).machine;
    }
    expect(machine.state).toBe("skip_detected");
    machine = transition(machine, { type: "USER_ADVANCE" }, SAMPLE_CHAI).machine;
    expect(machine.context.stepOutcomes[SAMPLE_CHAI.steps[0].id]).toBe("manual_confirmed");
  });
});

describe("object evidence scope", () => {
  it("requires learner confirmation when the requested check depends on temporal order", () => {
    const tutorial = structuredClone(SAMPLE_CHAI);
    tutorial.steps[0].successCheck = { ...tutorial.steps[0].successCheck, kind: "ordered_presence", orderObjectIds: ["obj_mortar", "obj_pestle"] };
    let machine = createCoach(tutorial);
    for (const type of ["START_COACH", "CAMERA_GRANTED", "READY", "CADENCE_TICK"] as const) machine = transition(machine, { type }, tutorial).machine;
    machine = transition(machine, { type: "SAM_RESULT", presence: { obj_mortar: true, obj_pestle: true } }, tutorial).machine;
    expect(machine.state).not.toBe("success");
    expect(machine.context.stepOutcomes[tutorial.steps[0].id]).toBe("unvisited");
  });
});

describe("limited object status claims", () => {
  it("never infers visible evidence from an empty object check", () => {
    const tutorial = structuredClone(SAMPLE_CHAI);
    tutorial.steps[0].objects = [];
    tutorial.steps[0].successCheck = { kind: "all_required_present", description: "No visual evidence is configured", requiredObjectIds: [] };
    let machine = createCoach(tutorial);
    for (const type of ["START_COACH", "CAMERA_GRANTED", "READY", "CADENCE_TICK"] as const) machine = transition(machine, { type }, tutorial).machine;
    machine = transition(machine, { type: "SAM_RESULT", presence: {} }, tutorial).machine;
    expect(machine.state).not.toBe("success");
  });
});
