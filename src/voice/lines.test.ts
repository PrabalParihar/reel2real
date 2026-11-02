import { describe, expect, it } from "vitest";
import { SAMPLE_ALOO, SAMPLE_CHAI } from "@/src/server/fixtures";
import { voiceLine } from "./lines";

describe("honest spoken object feedback", () => {
  it("reports visible objects without claiming the learner completed the action", () => {
    expect(voiceLine("success", SAMPLE_CHAI.steps[0])).toBe("Objects dikh rahe hain. Step khud confirm karo.");
  });

  it.each([
    ["skip_detected", "Zaroori object highlight nahi hua. Poora frame mein dikhao."],
    ["out_of_order", "Is step ke objects frame mein dikhao."],
  ] as const)("gives %s an object cue without claiming the learner's action or order", (state, expected) => {
    expect(voiceLine(state, SAMPLE_CHAI.steps[0])).toBe(expected);
  });

  it("keeps user Skip silent", () => {
    expect(voiceLine("user_skip", SAMPLE_CHAI.steps[0])).toBeNull();
  });

  it("preserves configured safety instructions and completion after the learner advances", () => {
    const step = SAMPLE_ALOO.steps[2];
    expect(voiceLine("safety_halt", step)).toBe(step.safety?.message);
    expect(voiceLine("tutorial_complete", SAMPLE_CHAI.steps[0])).toBe("Ho gaya.");
  });
});
