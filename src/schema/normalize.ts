import { DEFAULT_LIVE_MODE, SPARK_MODEL_ID } from "@/src/models";
import { validateTutorialSteps } from "./validate";
import type { Domain, SamObject, TutorialSteps, ValidationResult } from "./types";

export interface NormalizeInput {
  title?: string;
  domain?: Domain;
  creditLine?: string;
  filename?: string;
  durationSec?: number;
  mode?: TutorialSteps["generation"]["mode"];
}

interface DraftStep {
  id?: string;
  text?: string;
  instructionText?: string;
  completion?: string;
  objects?: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nounOf(value: unknown, index: number): { noun: string; prompt: string } | null {
  if (typeof value === "string" && value.trim()) {
    return { noun: value.trim(), prompt: value.trim() };
  }
  const record = asRecord(value);
  if (!record) return null;
  const noun = String(record.noun ?? record.name ?? record.text ?? "").trim();
  if (!noun) return null;
  const prompt = String(record.samPrompt ?? record.prompt ?? noun).trim();
  return { noun, prompt: prompt || noun };
}

function slug(value: string, index: number): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return cleaned || `object_${index + 1}`;
}

export function normalizeSparkPayload(payload: unknown, input: NormalizeInput = {}): ValidationResult {
  const record = asRecord(payload);
  if (record && typeof record.schemaVersion === "string") {
    return validateTutorialSteps(payload);
  }
  const rawSteps = Array.isArray(record?.steps) ? record.steps : [];
  const creditLine = input.creditLine?.trim() || "Sample · Self-filmed for Reel2Real demo. Not a public creator Reel";
  const duration = input.durationSec && input.durationSec > 0 ? input.durationSec : Math.max(rawSteps.length * 8, 8);
  const slice = duration / Math.max(rawSteps.length, 1);
  const steps = rawSteps.map((raw, index) => {
    const step = asRecord(raw) as DraftStep | null;
    const text = String(step?.instructionText ?? step?.text ?? "").trim() || `Step ${index + 1}`;
    const nouns = (step?.objects ?? []).map(nounOf).filter((item): item is { noun: string; prompt: string } => !!item).slice(0, 4);
    const objects: SamObject[] = nouns.map((item, objectIndex) => ({
      objectId: `obj_${slug(item.noun, objectIndex)}`,
      noun: item.noun,
      role: "required_present" as const,
      samPrompt: item.prompt,
      expectedTrack: true,
    }));
    return {
      id: String(step?.id ?? `step_${String(index + 1).padStart(2, "0")}`),
      index,
      instructionText: text,
      sourceTimeRange: {
        startSec: Number((index * slice).toFixed(2)),
        endSec: Number((Math.min(duration, (index + 1) * slice)).toFixed(2)),
      },
      credit: { creditLine, sampleLabel: true },
      objects,
      successCheck: {
        kind: "all_required_present" as const,
        description: String(step?.completion ?? text),
        requiredObjectIds: objects.map((object) => object.objectId),
        minStableChunks: 1,
      },
    };
  });

  const tutorial = {
    schemaVersion: "1.0.0",
    tutorialId: `local_${Date.now().toString(36)}`,
    title: input.title?.trim() || "Sample · Uploaded tutorial",
    domain: input.domain ?? "other",
    sampleLabel: true,
    attribution: {
      creatorName: "Local upload",
      creditLine,
      licence: "self_filmed_sample" as const,
    },
    sourceClip: {
      mediaType: "video/mp4" as const,
      durationSec: duration,
      localUri: input.filename ? `local-upload/${input.filename}` : "placeholders/local-upload.mp4",
    },
    generation: {
      mode: input.mode ?? "muse_spark_live",
      modelId: SPARK_MODEL_ID,
      apiBaseHint: "https://api.meta.ai/v1",
      generatedAtIso: new Date().toISOString(),
      toolCalls: [
        {
          tool: "muse_spark" as const,
          modelId: SPARK_MODEL_ID,
          purpose: "tutorial_transcript_to_steps_json",
          inputKind: "transcript" as const,
        },
      ],
    },
    runtimeHints: {
      preferredLiveMode: DEFAULT_LIVE_MODE,
      maxObjectsPerStep: 4,
    },
    steps,
  };
  return validateTutorialSteps(tutorial);
}
