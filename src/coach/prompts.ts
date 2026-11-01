import type { PreferredLiveMode, TutorialSteps } from "@/src/schema/types";
import { TIMEOUTS } from "@/src/fsm/types";

export interface SegmentPrompt {
  objectId: string;
  noun: string;
  samPrompt: string;
  role: string;
  lookahead: boolean;
}

export function promptsForStep(tutorial: TutorialSteps, stepIndex: number): SegmentPrompt[] {
  const step = tutorial.steps[stepIndex];
  if (!step) return [];
  const prompts: SegmentPrompt[] = step.objects.map((object) => ({
    objectId: object.objectId,
    noun: object.noun,
    samPrompt: object.samPrompt,
    role: object.role,
    lookahead: false,
  }));
  if (prompts.length >= 4) return prompts.slice(0, 4);
  const next = tutorial.steps[stepIndex + 1];
  const lookahead = next?.objects.find(
    (object) => object.role === "required_present" && !prompts.some((prompt) => prompt.objectId === object.objectId),
  );
  if (lookahead) {
    prompts.push({
      objectId: lookahead.objectId,
      noun: lookahead.noun,
      samPrompt: lookahead.samPrompt,
      role: lookahead.role,
      lookahead: true,
    });
  }
  return prompts.slice(0, 4);
}

/** Instruct stills stay at 3 nouns. Samples keep the lookahead that can add a fourth. */
export function segmentPrompts(tutorial: TutorialSteps, stepIndex: number): SegmentPrompt[] {
  const prompts = promptsForStep(tutorial, stepIndex);
  if (tutorial.sourceClip.stillPlaceholder) return prompts.slice(0, 3);
  return prompts;
}

export function capturePlan(mode: PreferredLiveMode): {
  inputKind: "image" | "video_chunk";
  cadenceMs: number;
  honesty: string;
} {
  if (mode === "chunk_video_1_2s") {
    return { inputKind: "video_chunk", cadenceMs: TIMEOUTS.CADENCE_MS, honesty: "Chunk mode" };
  }
  if (mode === "stills_only") {
    return { inputKind: "image", cadenceMs: TIMEOUTS.CADENCE_MS, honesty: "Stills mode · Sample" };
  }
  return { inputKind: "image", cadenceMs: TIMEOUTS.CADENCE_MS, honesty: "Keyframe mode" };
}
