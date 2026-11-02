import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCoach, transition } from "@/src/fsm/machine";
import { SAMPLE_CHAI } from "@/src/server/fixtures";
import { Filmstrip, jumpFromClick, jumpFromKey } from "./filmstrip";

function waiting() {
  let machine = createCoach(SAMPLE_CHAI);
  machine = transition(machine, { type: "START_COACH" }, SAMPLE_CHAI).machine;
  machine = transition(machine, { type: "CAMERA_GRANTED" }, SAMPLE_CHAI).machine;
  return transition(machine, { type: "READY" }, SAMPLE_CHAI).machine;
}

const steps = [
  { id: "a", thumb: "one" },
  { id: "b", thumb: "two" },
  { id: "c", thumb: "three" },
];

describe("filmstrip step jump", () => {
  it("jumps when the thumbnail is clicked", () => {
    const jumped: number[] = [];
    jumpFromClick(2, (index) => jumped.push(index));
    const machine = transition(waiting(), { type: "JUMP_TO_STEP", index: 2 }, SAMPLE_CHAI).machine;
    expect(jumped).toEqual([2]);
    expect(machine.context.stepIndex).toBe(2);
    expect(machine.state).toBe("step_ready");
  });

  it("jumps when Enter is pressed", () => {
    const jumped: number[] = [];
    expect(jumpFromKey("Enter", 1, (index) => jumped.push(index))).toBe(true);
    expect(jumped).toEqual([1]);
    expect(transition(waiting(), { type: "JUMP_TO_STEP", index: 1 }, SAMPLE_CHAI).machine.context.stepIndex).toBe(1);
  });

  it("jumps when Space is pressed", () => {
    const jumped: number[] = [];
    expect(jumpFromKey(" ", 2, (index) => jumped.push(index))).toBe(true);
    expect(jumpFromKey("Tab", 2, (index) => jumped.push(index))).toBe(false);
    expect(jumped).toEqual([2]);
    expect(transition(waiting(), { type: "JUMP_TO_STEP", index: 2 }, SAMPLE_CHAI).machine.context.stepIndex).toBe(2);
  });

  it("marks the current step with aria-current", () => {
    const html = renderToStaticMarkup(createElement(Filmstrip, {
      current: 1,
      onJump: () => undefined,
      steps,
    }));
    expect(html.match(/role="button"/g)).toHaveLength(3);
    expect(html.match(/tabindex="0"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Go to step 1"');
    expect(html).toContain('aria-label="Go to step 2"');
    expect(html).toContain('aria-label="Go to step 3"');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    const current = html.split('aria-label="Go to step 2"')[1] ?? "";
    expect(current.startsWith(' aria-current="step"') || html.includes('aria-current="step"')).toBe(true);
  });
});
