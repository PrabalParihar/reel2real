import { describe, expect, it } from "vitest";
import { coachStatusChip, stateChip } from "./ui";
describe("honest detection status", () => {
  it("labels presence as visibility rather than action correctness", () => {
    expect(stateChip("success")).toBe("Objects visible");
  });
  it("describes still-frame object heuristics without claiming a skipped action or wrong order", () => {
    expect(stateChip("skip_detected")).toBe("Required object not highlighted");
    expect(stateChip("out_of_order")).toBe("Check current-step objects");
    expect(stateChip("user_skip")).toBe("Skipped");
  });
  it("keeps the safety halt visible when the camera disconnects", () => {
    expect(coachStatusChip("safety_halt", true)).toBe("Safety");
  });
});
