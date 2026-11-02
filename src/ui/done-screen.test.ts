import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SAMPLE_CHAI } from "@/src/server/fixtures";
const state = vi.hoisted(() => ({ session: {} as Record<string, unknown> }));
vi.mock("./session", () => ({ useSession: () => state.session }));
import { DoneScreen } from "./DoneScreen";

function render(summary: unknown, tutorial: unknown = null) {
  state.session = { summary, tutorial, runtime: { mock: true }, prepare: null, stepsSource: null, sparkLatencyMs: null, reset() {} };
  return renderToStaticMarkup(createElement(DoneScreen));
}

describe("truthful session recap", () => {
  it("offers recovery without claiming completion after a cold /done visit", () => {
    const html = render(null);
    expect(html).toContain("No completed session");
    expect(html).toContain('href="/upload"');
    expect(html).not.toContain("Session complete");
    expect(html).not.toContain("Run again");
    expect(html).not.toContain("self-filmed");
  });

  it("renders each actual outcome instead of inferring Done for an unvisited step", () => {
    const html = render({ title: "Recap", steps: 1, skips: 0, safetyHits: 0, skippedStepIds: [], stepOutcomes: { [SAMPLE_CHAI.steps[0].id]: "unvisited", [SAMPLE_CHAI.steps[1].id]: "objects_visible" } }, SAMPLE_CHAI);
    expect(html).toContain("Unvisited");
    expect(html).toContain("Objects visible");
    expect(html).not.toContain(">Done<");
    expect(html).toContain("does not verify the action");
  });
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {}, replace() {} }) }));
import { CoachScreen } from "./CoachScreen";
describe("coach session recovery and controls", () => {
  it("explains the missing coach session instead of silently redirecting", () => {
    render(null);
    const html = renderToStaticMarkup(createElement(CoachScreen));
    expect(html).toContain("Session interrupted");
    expect(html).toContain('href="/upload"');
  });
  it("exposes voice and a real recheck to ordinary users", () => {
    render(null, SAMPLE_CHAI);
    const html = renderToStaticMarkup(createElement(CoachScreen));
    expect(html).toContain("Voice on");
    expect(html).toContain("Recheck objects");
    expect(html).toContain("Next confirms");
  });
});
