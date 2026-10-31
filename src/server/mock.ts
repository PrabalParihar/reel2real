import { SPARK_MODEL_ID, SAM_MODEL_ID } from "@/src/models";
import type { SparkClient, SparkRequest, SparkResult, SegmentationClient, SegmentRequest, SegmentResult, MaskHit, MockScenario } from "./types";
import { sampleById, sampleForTranscript } from "./fixtures";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RECTS: Record<string, { x: number; y: number; w: number; h: number }> = {
  mortar: { x: 0.3, y: 0.46, w: 0.26, h: 0.22 },
  pestle: { x: 0.52, y: 0.28, w: 0.1, h: 0.3 },
  ginger: { x: 0.2, y: 0.64, w: 0.18, h: 0.12 },
  cardamom: { x: 0.46, y: 0.66, w: 0.12, h: 0.08 },
  cup: { x: 0.68, y: 0.4, w: 0.16, h: 0.24 },
  knife: { x: 0.12, y: 0.22, w: 0.26, h: 0.07 },
  board: { x: 0.16, y: 0.42, w: 0.66, h: 0.36 },
  onion: { x: 0.4, y: 0.5, w: 0.18, h: 0.16 },
  chopped: { x: 0.38, y: 0.58, w: 0.22, h: 0.12 },
  wheel: { x: 0.5, y: 0.28, w: 0.3, h: 0.4 },
  chain: { x: 0.22, y: 0.5, w: 0.46, h: 0.14 },
  rag: { x: 0.18, y: 0.66, w: 0.22, h: 0.14 },
  pedal: { x: 0.62, y: 0.58, w: 0.14, h: 0.16 },
  oil: { x: 0.66, y: 0.36, w: 0.12, h: 0.22 },
};

function rectFor(noun: string, index: number) {
  const key = Object.keys(RECTS).find((item) => noun.toLowerCase().includes(item));
  if (key) return RECTS[key];
  return { x: 0.12 + (index % 3) * 0.22, y: 0.4 + Math.floor(index / 3) * 0.16, w: 0.18, h: 0.14 };
}

function presentFor(prompt: SegmentRequest["prompts"][number], scenario: MockScenario, phase: number): boolean {
  if (scenario === "mask_lost") {
    if (phase < 1) return prompt.role !== "safety_prop" && prompt.role !== "required_absent" && !prompt.lookahead;
    return false;
  }
  if (scenario === "skip") return false;
  if (scenario === "out_of_order") return !!prompt.lookahead;
  if (scenario === "safety") return prompt.role === "safety_prop" || prompt.noun.includes("knife") || (!prompt.lookahead && prompt.role === "required_present");
  return !prompt.lookahead && prompt.role !== "safety_prop" && prompt.role !== "required_absent";
}

export function createMockSparkClient(options?: { delayMs?: number }): SparkClient {
  const delayMs = options?.delayMs ?? 0;
  return {
    mode: "mock",
    modelId: SPARK_MODEL_ID,
    async generateSteps(input: SparkRequest): Promise<SparkResult> {
      const started = performance.now();
      if (delayMs > 0) await wait(delayMs);
      const tutorial = input.sampleId
        ? sampleById(input.sampleId)
        : sampleForTranscript(input.transcript, input.domain);
      if (input.title) tutorial.title = input.title;
      if (input.creditLine) {
        tutorial.attribution.creditLine = input.creditLine;
        for (const step of tutorial.steps) step.credit.creditLine = input.creditLine;
      }
      if (input.filename) tutorial.sourceClip.localUri = `local-upload/${input.filename}`;
      const latencyMs = Math.round(performance.now() - started);
      const toolCalls = [
        {
          tool: "muse_spark" as const,
          modelId: SPARK_MODEL_ID,
          purpose: "mock_curated_sample_no_live_call",
          inputKind: "transcript" as const,
          latencyMs,
        },
      ];
      return {
        mode: "mock",
        modelId: SPARK_MODEL_ID,
        latencyMs,
        schemaValid: true,
        parseOk: true,
        errors: [],
        tutorial,
        toolCalls,
      };
    },
  };
}

export function createMockSegmentationClient(): SegmentationClient {
  return {
    mode: "mock",
    modelId: SAM_MODEL_ID,
    async segment(input: SegmentRequest): Promise<SegmentResult> {
      const started = performance.now();
      await wait(20);
      const scenario = input.scenario ?? "on_track";
      const phase = input.phase ?? 0;
      const masks: MaskHit[] = input.prompts.slice(0, 4).map((prompt, index) => {
        const present = presentFor(prompt, scenario, phase);
        return {
          objectId: prompt.objectId,
          noun: prompt.noun,
          present,
          trackId: present ? `mock-${prompt.objectId}` : undefined,
          box: present ? rectFor(prompt.noun, index) : undefined,
        };
      });
      const latencyMs = Math.round(performance.now() - started);
      return {
        mode: "mock",
        modelId: SAM_MODEL_ID,
        latencyMs,
        ok: true,
        timedOut: false,
        inputKind: input.inputKind,
        masks,
        toolCall: {
          tool: "sam_3_1",
          modelId: SAM_MODEL_ID,
          purpose: "keyframe_object_masks",
          inputKind: input.inputKind === "video_chunk" ? "video_chunk" : "image",
          latencyMs,
        },
      };
    },
  };
}
