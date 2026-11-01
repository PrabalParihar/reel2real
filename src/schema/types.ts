export const SCHEMA_VERSION = "1.0.0" as const;

export type Domain = "indian_recipe" | "non_cooking_diy" | "other";
export type Licence = "self_filmed_sample" | "written_permission" | "other_cleared";
export type GenerationMode = "muse_spark_live" | "muse_spark_curated" | "hand_authored";
export type PreferredLiveMode = "chunk_video_1_2s" | "keyframe_still" | "stills_only";
export type ToolName = "muse_spark" | "sam_3_1" | "tts" | "other";
export type InputKind = "transcript" | "clip" | "image" | "video_chunk" | "text";
export type ObjectRole = "required_present" | "required_absent" | "optional" | "safety_prop";
export type SuccessKind =
  | "all_required_present"
  | "required_present_and_absent"
  | "ordered_presence"
  | "manual_confirm_only";

export interface ToolCall {
  tool: ToolName;
  modelId: string;
  purpose: string;
  requestId?: string;
  inputKind?: InputKind;
  latencyMs?: number;
}

export interface SamObject {
  objectId: string;
  noun: string;
  role: ObjectRole;
  samPrompt: string;
  expectedTrack?: boolean;
}

export interface SuccessCheck {
  kind: SuccessKind;
  description: string;
  requiredObjectIds?: string[];
  forbiddenObjectIds?: string[];
  orderObjectIds?: string[];
  minStableChunks?: number;
}

export interface TutorialStep {
  id: string;
  index: number;
  instructionText: string;
  hinglishPrompt?: string;
  sourceTimeRange: { startSec: number; endSec: number; description?: string };
  credit: { creditLine: string; creatorName?: string; sampleLabel?: boolean };
  objects: SamObject[];
  successCheck: SuccessCheck;
  safety?: { ruleId?: string; triggerObjectIds?: string[]; message?: string };
  generation?: { modelId?: string; toolCalls?: ToolCall[]; curatedByHuman?: boolean };
}

export interface TutorialSteps {
  schemaVersion: typeof SCHEMA_VERSION;
  tutorialId: string;
  title: string;
  domain?: Domain;
  sampleLabel: boolean;
  attribution: {
    creatorName: string;
    creditLine: string;
    licence: Licence;
    permissionDocPath?: string;
  };
  sourceClip: {
    mediaType: "video/mp4" | "video/webm";
    durationSec: number;
    /** Server stand-in timing for an instruction still. Samples omit this. */
    stillPlaceholder?: boolean;
    localUri?: string;
    width?: number;
    height?: number;
  };
  generation: {
    mode: GenerationMode;
    modelId: string;
    apiBaseHint?: string;
    promptDigest?: string;
    generatedAtIso?: string;
    toolCalls: ToolCall[];
  };
  runtimeHints?: {
    preferredLiveMode?: PreferredLiveMode;
    maxObjectsPerStep?: number;
    safetyRuleId?: string;
  };
  steps: TutorialStep[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: TutorialSteps }
  | { ok: false; errors: ValidationIssue[] };
