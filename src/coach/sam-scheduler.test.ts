import { describe, expect, it } from "vitest";
import {
  decideSamPoll,
  initialSamSchedulerState,
  markSamSettled,
  readSamSchedulerConfig,
  type SamSchedulerState,
} from "./sam-scheduler";

const config = { minIntervalMs: 2000, sessionCap: 60 };

function poll(state: SamSchedulerState, now: number, extra: Partial<Parameters<typeof decideSamPoll>[0]> = {}) {
  return decideSamPoll({
    now,
    state,
    hidden: false,
    stepDone: false,
    coachState: "tracking",
    config,
    ...extra,
  });
}

describe("SAM poll scheduler", () => {
  it("refuses a second call while one is in flight", () => {
    const first = poll(initialSamSchedulerState(), 0);
    expect(first.action).toBe("start");
    if (first.action !== "start") return;
    expect(first.state.inFlight).toBe(true);
    expect(first.state.calls).toBe(1);
    const second = poll(first.state, 5_000);
    expect(second).toEqual({ action: "wait", reason: "in_flight", waitMs: 2000 });
    const settled = markSamSettled(first.state);
    expect(settled.inFlight).toBe(false);
    expect(settled.calls).toBe(1);
  });

  it("waits out the minimum interval", () => {
    const started = poll(initialSamSchedulerState(), 1_000);
    if (started.action !== "start") throw new Error("expected start");
    const early = poll(markSamSettled(started.state), 2_999);
    expect(early).toEqual({ action: "wait", reason: "interval", waitMs: 1 });
    const ready = poll(markSamSettled(started.state), 3_000);
    expect(ready.action).toBe("start");
  });

  it("pauses while the tab is hidden", () => {
    const decision = poll(initialSamSchedulerState(), 0, { hidden: true });
    expect(decision).toEqual({ action: "pause", reason: "hidden" });
  });

  it("pauses on error_recoverable and when the step is done", () => {
    expect(poll(initialSamSchedulerState(), 0, { coachState: "error_recoverable" }).action).toBe("pause");
    expect(poll(initialSamSchedulerState(), 0, { stepDone: true })).toEqual({ action: "pause", reason: "step_done" });
  });

  it("stops after the session cap", () => {
    let state = initialSamSchedulerState();
    for (let i = 0; i < config.sessionCap; i += 1) {
      const decision = poll(state, i * config.minIntervalMs);
      expect(decision.action).toBe("start");
      if (decision.action !== "start") return;
      state = markSamSettled(decision.state);
    }
    expect(state.calls).toBe(60);
    expect(poll(state, 60 * config.minIntervalMs)).toEqual({ action: "pause", reason: "session_cap" });
  });

  it("reads the public interval and cap", () => {
    expect(readSamSchedulerConfig({}).minIntervalMs).toBe(2000);
    expect(readSamSchedulerConfig({}).sessionCap).toBe(60);
    expect(readSamSchedulerConfig({ NEXT_PUBLIC_SAM_MIN_INTERVAL_MS: "2500", NEXT_PUBLIC_SAM_SESSION_CAP: "12" })).toEqual({
      minIntervalMs: 2500,
      sessionCap: 12,
    });
    expect(readSamSchedulerConfig({ NEXT_PUBLIC_SAM_SESSION_CAP: "0" }).sessionCap).toBe(60);
  });
});
