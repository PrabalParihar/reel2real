import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { instructSamChip, instructSamOverlay } from "./instruct-chips";
import {
  LIVE_COACHING_OFF_BODY,
  LIVE_COACHING_OFF_TITLE,
  SAMPLES_HREF,
  isLiveCoachingOff,
} from "./LiveCoachingOff";
import { musePublicDegrade } from "@/src/server/muse-forward";
import { samForwardDegrade } from "@/src/server/sam-forward";

describe("public degrade", () => {
  it("does not claim a live model", () => {
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

  it("maps instruct and spark degrade to the sample offer, and refusal wins", () => {
    expect(isLiveCoachingOff(musePublicDegrade("instruct"))).toBe(true);
    expect(isLiveCoachingOff(musePublicDegrade("transcript"))).toBe(true);
    expect(isLiveCoachingOff({ mode: "degraded", refused: true })).toBe(false);
    expect(LIVE_COACHING_OFF_TITLE).toBe("Live coaching is off right now.");
    expect(LIVE_COACHING_OFF_BODY).toBe("Try a Sample.");
    expect(SAMPLES_HREF).toBe("/#demos");
    const instruct = readFileSync("src/ui/InstructScreen.tsx", "utf8");
    const extracting = readFileSync("src/ui/ExtractingScreen.tsx", "utf8");
    expect(instruct).toContain("LiveCoachingOff");
    expect(instruct).toContain("isLiveCoachingOff");
    expect(extracting).toContain("LiveCoachingOff");
    expect(extracting).toContain("isLiveCoachingOff");
    expect(instruct).not.toContain("Highlights unavailable");
    expect(extracting).not.toContain("Highlights unavailable");
  });

  it("keeps Highlights unavailable on the SAM chip", () => {
    expect(instructSamOverlay("failed", "Checking…")).toBe("Highlights unavailable");
    expect(instructSamChip(false, "failed")).toBe("SAM unavailable");
    expect(readFileSync("src/ui/LiveCoachingOff.tsx", "utf8")).not.toContain("Highlights unavailable");
    expect(readFileSync("src/ui/LiveCoachingOff.tsx", "utf8")).not.toContain("\u2014");
    expect(readFileSync("src/ui/LiveCoachingOff.tsx", "utf8")).not.toContain("\u2013");
  });
});