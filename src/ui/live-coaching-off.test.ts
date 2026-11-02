import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { POST as sparkPost } from "../../app/api/spark/route";
import { instructSamChip, instructSamOverlay } from "./instruct-chips";
import {
  LIVE_COACHING_OFF_BODY,
  LIVE_COACHING_OFF_TITLE,
  SAMPLES_HREF,
  goalEcho,
  isLiveCoachingOff,
  liveOffSampleCards,
} from "./LiveCoachingOff";
import { musePublicDegrade } from "@/src/server/muse-forward";
import { recordedSampleStatus, RECORDED_SAM_LABEL, usesRecordedSam } from "@/src/samples/scene";
import { samForwardDegrade } from "@/src/server/sam-forward";
import { interpretInstructResponse } from "./instruct-result";

const instructSource = () => readFileSync("src/ui/InstructScreen.tsx", "utf8");
const extractingSource = () => readFileSync("src/ui/ExtractingScreen.tsx", "utf8");
const offSource = () => readFileSync("src/ui/LiveCoachingOff.tsx", "utf8");

describe("public degrade", () => {
  it("returns mode degraded and modelId null for Muse and SAM", () => {
    for (const body of [musePublicDegrade("instruct"), musePublicDegrade("transcript")]) {
      expect(body.mode).toBe("degraded");
      expect(body.modelId).toBeNull();
      expect(body.errors).not.toContain("Highlights unavailable");
    }
    const segment = samForwardDegrade({ timedOut: false, inputKind: "image" });
    expect(segment.mode).toBe("degraded");
    expect(segment.modelId).toBeNull();
    expect(segment.toolCall.modelId).toBeNull();
  });

  it("renders the typed goal in the echo", () => {
    expect(goalEcho("Make a chai spice mix")).toBe("Your goal: Make a chai spice mix");
    expect(goalEcho("  brew   <b>tea</b>  ")).toBe("Your goal: brew btea/b");
    expect(goalEcho("x".repeat(90)).startsWith("Your goal: ")).toBe(true);
    expect(goalEcho("x".repeat(90)).endsWith("...")).toBe(true);
    expect(goalEcho("x".repeat(90)).length).toBeLessThan(90);
    expect(offSource()).toContain('<p className="live-off-goal">{echo}</p>');
    expect(instructSource()).toContain("goal={goal}");
  });

  it("omits the echo when there is no goal", () => {
    expect(goalEcho("")).toBe("");
    expect(goalEcho("   ")).toBe("");
    expect(offSource()).toContain('{echo ? <p className="live-off-goal">{echo}</p> : null}');
    expect(extractingSource()).toContain("session.prepare?.transcript?.trim() || undefined");
  });

  it("returns Edit goal to the input with the goal prefilled", () => {
    const instruct = instructSource();
    expect(instruct).toContain("onEdit={() => setCoachingOff(false)}");
    expect(instruct).toContain("value={goal}");
    expect(instruct).not.toMatch(/onEdit=\{[^}]*setGoal\(/);
    expect(offSource()).toContain(">Edit goal</button>");
  });

  it("sends Edit to /upload when there is no goal", () => {
    expect(offSource()).toContain("{!echo && backHref ? (");
    expect(offSource()).toContain('href={backHref}>Edit</Link>');
    expect(extractingSource()).toContain('backHref="/upload"');
  });

  it("renders 3 Sample cards and none of them is flask", () => {
    const samples = liveOffSampleCards();
    expect(samples).toHaveLength(3);
    expect(samples.map((sample) => sample.id)).toEqual(["masala-chai", "latte-art", "origami"]);
    expect(samples.some((sample) => sample.id.includes("flask") || sample.image.includes("flask"))).toBe(false);
    expect(samples.map((sample) => sample.image)).toEqual([
      "/samples/masala-chai/hero.jpg",
      "/samples/latte-art/hero.jpg",
      "/samples/origami/hero.jpg",
    ]);
    expect(samples.every((sample) => sample.title.length > 0)).toBe(true);
  });

  it("links each Sample card to /extracting?demo=<id>", () => {
    expect(liveOffSampleCards().map((sample) => sample.href)).toEqual([
      "/extracting?demo=masala-chai",
      "/extracting?demo=latte-art",
      "/extracting?demo=origami",
    ]);
    expect(SAMPLES_HREF).toBe("/#demos");
  });

  it("uses the recorded Samples subline", () => {
    expect(LIVE_COACHING_OFF_BODY).toBe("Recorded Samples still show every step.");
    expect(LIVE_COACHING_OFF_TITLE).toBe("Live coaching is off right now.");
    expect(offSource()).toContain("{LIVE_COACHING_OFF_BODY}");
  });

  it("lets the refusal beat the coaching-off panel", () => {
    expect(isLiveCoachingOff({ mode: "degraded", refused: true })).toBe(false);
    expect(isLiveCoachingOff(musePublicDegrade("instruct"))).toBe(true);
    expect(isLiveCoachingOff(musePublicDegrade("transcript"))).toBe(true);
    const instruct = instructSource();
    expect(interpretInstructResponse({ ...musePublicDegrade("instruct"), refused: true, reason: "Task refused for safety." }, true)).toEqual({ kind: "refusal", reason: "Task refused for safety." });
    expect(instruct).not.toContain("Highlights unavailable");
    expect(extractingSource()).not.toContain("Highlights unavailable");
  });

  it("keeps Highlights unavailable on the SAM chip", () => {
    expect(instructSamOverlay("failed", "Checking…")).toBe("Highlights unavailable");
    expect(instructSamChip(false, "failed")).toBe("SAM unavailable");
    expect(offSource()).not.toContain("Highlights unavailable");
    expect(offSource()).not.toContain("\u2014");
    expect(offSource()).not.toContain("\u2013");
  });

  it("plays a Sample card from recorded SAM and does not call Meta", async () => {
    expect(usesRecordedSam("sample")).toBe(true);
    expect(usesRecordedSam("instruct")).toBe(false);
    expect(usesRecordedSam("clip")).toBe(false);
    expect(recordedSampleStatus(true, false)).toBe(RECORDED_SAM_LABEL);
    expect(recordedSampleStatus(true, true)).toBeNull();
    expect(RECORDED_SAM_LABEL).toBe("Sample · recorded SAM output");
    const coach = readFileSync("src/ui/useCoach.ts", "utf8");
    const screen = readFileSync("src/ui/CoachScreen.tsx", "utf8");
    const guard = coach.indexOf("if (cancelled || options.recordedSample) return;");
    const segmentCall = coach.indexOf('fetch("/api/segment"');
    expect(guard).toBeGreaterThan(-1);
    expect(segmentCall).toBeGreaterThan(guard);
    expect(coach.indexOf("if (options.recordedSample)")).toBeLessThan(coach.indexOf("openRearCamera("));
    expect(screen).toContain("recordedSample: recordedRun");
    expect(screen).toContain("recordedSampleStatus(recordedRun && showRecorded, noVerifiedMask)");

    const previousKey = process.env.META_MODEL_API_KEY;
    const previousModel = process.env.MODEL_API_KEY;
    const previousFlag = process.env.MUSE_FORWARD_ENABLED;
    delete process.env.MUSE_FORWARD_ENABLED;
    delete process.env.MODEL_API_KEY;
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    const fetchMock = vi.fn(async () => {
      throw new Error("Meta must not be called for a recorded Sample");
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const response = await sparkPost(new Request("http://local/api/spark", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.71",
        },
        body: JSON.stringify({
          sampleId: "masala-chai",
          creatorName: "Sample cook",
          licenceChoice: "self_filmed",
        }),
      }));
      const body = await response.json() as { inputKind?: string; tutorial?: { title?: string } };
      expect(response.status).toBe(200);
      expect(body.inputKind).toBe("sample");
      expect(body.tutorial?.title).toContain("chai");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (previousKey === undefined) delete process.env.META_MODEL_API_KEY;
      else process.env.META_MODEL_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.MODEL_API_KEY;
      else process.env.MODEL_API_KEY = previousModel;
      if (previousFlag === undefined) delete process.env.MUSE_FORWARD_ENABLED;
      else process.env.MUSE_FORWARD_ENABLED = previousFlag;
      vi.unstubAllGlobals();
    }
  });
});
