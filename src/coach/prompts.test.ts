import { describe, expect, it } from "vitest";
import type { TutorialSteps } from "@/src/schema/types";
import { segmentPrompts } from "./prompts";

function tutorial(still: boolean, counts: number[]): TutorialSteps {
  return {
    schemaVersion: "1.0.0",
    tutorialId: still ? "instruct-goal" : "sample-goal",
    title: "Goal",
    sampleLabel: !still,
    attribution: { creatorName: "You", creditLine: "You", licence: "self_filmed_sample" },
    sourceClip: { mediaType: "video/mp4", durationSec: still ? 8 : 40, stillPlaceholder: still || undefined },
    generation: { mode: "muse_spark_live", modelId: "muse-spark-1.3", toolCalls: [] },
    steps: counts.map((count, index) => ({
      id: `step_${index + 1}`,
      index,
      instructionText: `Step ${index + 1}`,
      sourceTimeRange: { startSec: index, endSec: index + 1 },
      credit: { creditLine: "You" },
      objects: Array.from({ length: count }, (_, objectIndex) => ({
        objectId: `o${index}_${objectIndex}`,
        noun: `object ${objectIndex}`,
        role: "required_present" as const,
        samPrompt: `object ${objectIndex}`,
      })),
      successCheck: { kind: "all_required_present" as const, description: "visible" },
    })),
  };
}

describe("segment prompt fan-out", () => {
  it("caps an instruct still at 3 nouns and leaves a sample lookahead alone", () => {
    expect(segmentPrompts(tutorial(true, [3, 2]), 0)).toHaveLength(3);
    expect(segmentPrompts(tutorial(false, [3, 2]), 0)).toHaveLength(4);
  });
});