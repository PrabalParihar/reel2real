import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SAMPLE_CHAI } from "@/src/server/fixtures";
const state = vi.hoisted(() => ({ session: {} as Record<string, unknown> }));
vi.mock("./session", () => ({ useSession: () => state.session }));
import { DoneScreen } from "./DoneScreen";

function render(summary: unknown, tutorial: unknown = null, session: Record<string, unknown> = {}) {
  state.session = { summary, tutorial, runtime: { mock: true }, prepare: null, stepsSource: null, sparkLatencyMs: null, reset() {}, ...session };
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

  const summary = { title: "Recap", steps: 1, skips: 0, safetyHits: 0, skippedStepIds: [], stepOutcomes: {} };
  const stillPlan = { ...SAMPLE_CHAI, sourceClip: { ...SAMPLE_CHAI.sourceClip, stillPlaceholder: true } };

  it.each(["instruct", "cache", "cap_cache"])("retains still origin in a live %s recap even on a mock runtime", (stepsSource) => {
    const html = render(summary, stillPlan, { stepsSource, resultProvenance: { mode: "live", modelId: "muse-spark-1.3" } });
    expect(html).toContain("Plan from still");
    expect(html).not.toContain("Steps from clip");
    expect(html).not.toContain("Mock");
    expect(html).not.toContain("Sample steps");
  });

  it("uses the instruction source when the still-placeholder flag is absent", () => {
    const html = render(summary, SAMPLE_CHAI, { stepsSource: "instruct", resultProvenance: { mode: "live", modelId: "muse-spark-1.3" } });
    expect(html).toContain("Plan from still");
    expect(html).not.toContain("Steps from clip");
  });

  it("explicitly labels a mock still plan even on a live runtime", () => {
    const html = render(summary, stillPlan, { stepsSource: "instruct", runtime: { mock: false }, resultProvenance: { mode: "mock", modelId: null } });
    expect(html).toContain("Plan from still · Mock");
    expect(html).not.toContain("Steps from clip");
  });

  it.each(["clip", "cache", "cap_cache"])("preserves live upload provenance for %s results", (stepsSource) => {
    const html = render(summary, SAMPLE_CHAI, { stepsSource, prepare: { hasClip: true }, resultProvenance: { mode: "live", modelId: "muse-spark-1.3" } });
    expect(html).toContain("Steps from clip");
    expect(html).not.toContain("Plan from still");
    expect(html).not.toContain("Sample steps");
  });

  it("keeps recorded samples labeled Sample even on a live runtime", () => {
    const html = render(summary, SAMPLE_CHAI, { stepsSource: "sample", runtime: { mock: false } });
    expect(html).toContain("Sample steps");
    expect(html).not.toContain("Steps from clip");
  });

  it("labels the mixed count accurately when another visited step was skipped", () => {
    const html = render({ ...summary, skips: 1, stepOutcomes: { first: "manual_confirmed", second: "objects_visible", third: "skipped", fourth: "unvisited" } }, SAMPLE_CHAI);
    expect(html).toContain("<strong>2</strong><span>confirmed or visible steps</span>");
    expect(html).not.toContain("visited steps");
  });

  it("does not call object visibility a learner confirmation after a jump and one Next", () => {
    const html = render({ ...summary, stepOutcomes: {
      [SAMPLE_CHAI.steps[0].id]: "objects_visible",
      [SAMPLE_CHAI.steps[1].id]: "unvisited",
      [SAMPLE_CHAI.steps[2].id]: "manual_confirmed",
    } }, SAMPLE_CHAI);
    expect(html).toContain("<strong>2</strong><span>confirmed or visible steps</span>");
    expect(html).not.toContain("<span>confirmed steps</span>");
    expect(html).toContain("<span>Objects visible</span>");
    expect(html).toContain("<span>Unvisited</span>");
    expect(html).toContain("<span>You confirmed</span>");
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
