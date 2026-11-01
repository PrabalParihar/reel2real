import type { PreferredLiveMode, ToolCall, TutorialSteps } from "@/src/schema/types";

export type StepsInputKind = "clip" | "transcript" | "sample" | "instruct";
export type LicenceChoice = "self_filmed" | "permission_granted";

export interface SparkRequest {
  transcript?: string;
  title?: string;
  domain?: TutorialSteps["domain"];
  filename?: string;
  durationSec?: number;
  sampleId?: string;
  videoBase64?: string;
  mimeType?: string;
  creatorName?: string;
  licenceChoice?: LicenceChoice;
  creditLink?: string;
}

export interface SparkResult {
  mode: "live" | "mock" | "degraded";
  /** Null when no model was called. */
  modelId: string | null;
  latencyMs: number;
  schemaValid: boolean;
  parseOk: boolean;
  errors: string[];
  tutorial: TutorialSteps | null;
  toolCalls: ToolCall[];
  inputKind: StepsInputKind;
  refused?: boolean;
  refusalReason?: string;
  /** Redacted model text, capped at 4KB. Present on instruct schema failure only. */
  debug?: string;
}

export interface SegmentPromptInput {
  objectId: string;
  noun: string;
  samPrompt: string;
  role?: string;
  lookahead?: boolean;
}

export interface SegmentRequest {
  inputKind: "image" | "video_chunk";
  mediaBase64?: string;
  mediaPath?: string;
  mimeType?: string;
  prompts: SegmentPromptInput[];
  timeoutMs: number;
  scenario?: MockScenario;
  phase?: number;
}

export type MockScenario = "on_track" | "skip" | "out_of_order" | "safety" | "mask_lost";

export interface MaskHit {
  objectId: string;
  noun: string;
  present: boolean;
  trackId?: string;
  box?: { x: number; y: number; w: number; h: number };
}

export interface SegmentResult {
  mode: "live" | "mock" | "degraded";
  /** Null when no model was called. */
  modelId: string | null;
  latencyMs: number;
  ok: boolean;
  timedOut: boolean;
  error?: string;
  httpStatus?: number;
  inputKind: "image" | "video_chunk";
  masks: MaskHit[];
  toolCall: Omit<ToolCall, "modelId"> & { modelId?: string | null };
}

export interface SparkClient {
  readonly mode: "live" | "mock";
  readonly modelId: string;
  generateSteps(input: SparkRequest): Promise<SparkResult>;
}

export interface SegmentationClient {
  readonly mode: "live" | "mock";
  readonly modelId: string;
  segment(input: SegmentRequest): Promise<SegmentResult>;
}

export interface ModelClients {
  mode: "live" | "mock";
  spark: SparkClient;
  segmentation: SegmentationClient;
  liveModeDefault: PreferredLiveMode;
}
