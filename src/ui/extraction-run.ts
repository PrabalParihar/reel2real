import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import type { SparkResult } from "@/src/server/types";
import type { PrepareRequest, ResultProvenance, StepsSource } from "./session";
import { postSpark, type ExtractStage } from "./sparkOnce";
import { REFUSAL_UNSAFE } from "@/src/safety/goal-screen";
import { isLiveCoachingOff } from "./LiveCoachingOff";
import { readStepsCache, writeStepsCache, type CachedSteps } from "./steps-cache";

export interface ExtractionState {
  prepare: PrepareRequest | null;
  elapsed: number;
  stage: ExtractStage;
  attempt: number;
  manualRetries: number;
  error: string | null;
  refusal: string | null;
  coachingOff: boolean;
  capped: boolean;
}

type ExtractionEvent =
  | { type: "start"; prepare: PrepareRequest | null }
  | { type: "stage"; prepare: PrepareRequest; stage: ExtractStage }
  | { type: "elapsed"; prepare: PrepareRequest; elapsed: number }
  | { type: "error" | "invalid" | "refusal"; prepare: PrepareRequest; message: string }
  | { type: "retry"; prepare: PrepareRequest }
  | { type: "off" | "cap"; prepare: PrepareRequest };

export function initialExtraction(prepare: PrepareRequest | null): ExtractionState {
  return { prepare, elapsed: 0, stage: prepare?.hasClip ? "upload" : "reading", attempt: 0, manualRetries: 0, error: null, refusal: null, coachingOff: false, capped: false };
}

export const MAX_PREPARATION_RETRIES = 2;

export function canRetryExtraction(state: ExtractionState): boolean {
  return Boolean(state.prepare && state.error && !state.refusal && !state.coachingOff && !state.capped && state.manualRetries < MAX_PREPARATION_RETRIES);
}

export function extractionStageLabel(stage: ExtractStage, prepare: PrepareRequest | null): string {
  const recorded = Boolean(prepare?.sampleId && !prepare.hasClip);
  const labels: Record<ExtractStage, string> = recorded
    ? { upload: "Loading saved sample", reading: "Loading saved instructions", validating: "Checking saved instructions", preparing: "Preparing recorded coach" }
    : { upload: "Uploading clip", reading: prepare?.hasClip ? "Spark reading video" : "Spark reading transcript", validating: "Validating steps", preparing: "Preparing coach" };
  return labels[stage];
}

export function extractionReducer(state: ExtractionState, event: ExtractionEvent): ExtractionState {
  if (event.type === "start") return initialExtraction(event.prepare);
  if (state.prepare !== event.prepare) return state;
  switch (event.type) {
    case "retry": return canRetryExtraction(state)
      ? { ...state, error: null, elapsed: 0, stage: state.prepare?.hasClip ? "upload" : "reading", manualRetries: state.manualRetries + 1 }
      : state;
    case "stage": return { ...state, stage: event.stage };
    case "elapsed": return { ...state, elapsed: event.elapsed };
    case "error": return { ...state, error: event.message };
    case "invalid": return state.attempt < 1 ? { ...state, attempt: state.attempt + 1 } : { ...state, error: event.message };
    case "refusal": return { ...state, refusal: event.message };
    case "off": return { ...state, coachingOff: true };
    case "cap": return { ...state, capped: true };
  }
}

interface ExtractionServices {
  read: typeof readStepsCache;
  write: typeof writeStepsCache;
  post: typeof postSpark;
}

type PreparedLesson =
  | { kind: "tutorial"; tutorial: TutorialSteps; toolCalls: ToolCall[]; source: StepsSource; latencyMs: number; provenance: ResultProvenance; persistenceNote?: string }
  | { kind: "refusal" | "invalid"; message: string }
  | { kind: "off" | "cap" };

function cachedLesson(cached: CachedSteps, source: "cache" | "cap_cache"): PreparedLesson | null {
  if (!cached.provenance) return null;
  return { kind: "tutorial", tutorial: cached.tutorial, toolCalls: cached.toolCalls, source, latencyMs: 0, provenance: cached.provenance };
}

/** Cache is optional; a daily cap never substitutes a different lesson or changes its author. */
export async function extractPreparedLesson(
  prepare: PrepareRequest,
  options: { signal?: AbortSignal; onStage?: (stage: ExtractStage) => void } = {},
  services: ExtractionServices = { read: readStepsCache, write: writeStepsCache, post: postSpark },
): Promise<PreparedLesson> {
  const ensureCurrent = () => options.signal?.throwIfAborted();
  const readCache = async () => {
    if (!prepare.clipHash) return null;
    try { return await services.read(prepare.clipHash, prepare); } catch { return null; }
  };
  ensureCurrent();
  const cached = await readCache();
  ensureCurrent();
  if (cached) {
    const saved = cachedLesson(cached, "cache");
    if (saved) return saved;
  }
  let result: SparkResult;
  try {
    result = await services.post(prepare, options.onStage, { signal: options.signal });
  } catch (error) {
    ensureCurrent();
    if (error instanceof Error && (error as Error & { code?: string }).code === "daily_cap") {
      const capCached = await readCache();
      ensureCurrent();
      return capCached && cachedLesson(capCached, "cap_cache") || { kind: "cap" };
    }
    throw error;
  }
  ensureCurrent();
  options.onStage?.("validating");
  if (result.refused) return { kind: "refusal", message: result.refusalReason || REFUSAL_UNSAFE };
  if (isLiveCoachingOff(result)) return { kind: "off" };
  if (!result.schemaValid || !result.tutorial) return { kind: "invalid", message: result.errors[0] || "The steps JSON did not validate." };
  let persistenceNote: string | undefined;
  if (prepare.clipHash && result.mode !== "degraded" && result.inputKind !== "instruct") {
    let stored = false;
    try {
      stored = await services.write(prepare.clipHash, { tutorial: result.tutorial, toolCalls: result.toolCalls, inputKind: result.inputKind, provenance: { mode: result.mode, modelId: result.modelId } }, prepare);
    } catch { /* A usable tutorial never depends on storage. */ }
    if (!stored) persistenceNote = "Steps are ready. This browser could not save them for reuse.";
  }
  ensureCurrent();
  return { kind: "tutorial", tutorial: result.tutorial, toolCalls: result.toolCalls, source: result.inputKind, latencyMs: result.latencyMs, provenance: { mode: result.mode, modelId: result.modelId }, persistenceNote };
}
