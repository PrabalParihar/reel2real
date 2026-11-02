import { describe, expect, it } from "vitest";
import { coachStatusChip, stateChip } from "./ui";
describe("honest detection status", () => {
  it("labels presence as visibility rather than action correctness", () => {
    expect(stateChip("success")).toBe("Objects visible");
  });
  it("keeps the safety halt visible when the camera disconnects", () => {
    expect(coachStatusChip("safety_halt", true)).toBe("Safety");
  });
});
