"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import { sampleByPublishedId } from "@/src/domains/catalog";
import legacySample from "@/src/fixtures/sample-aloo-jeera.steps.json";
import { DEFAULT_RUNTIME, loadRuntime, type RuntimeInfo } from "./runtime-preflight";
export type { RuntimeInfo } from "./runtime-preflight";

export type StepsSource = "clip" | "transcript" | "sample" | "cache" | "cap_cache" | "cap_sample" | "instruct";

export interface PrepareRequest {
  key: string;
  sampleId?: string;
  transcript?: string;
  title?: string;
  domain?: TutorialSteps["domain"];
  filename?: string;
  durationSec?: number;
  videoBase64?: string;
  mimeType?: string;
  creatorName?: string;
  licenceChoice?: "self_filmed" | "permission_granted";
  creditLink?: string;
  clipHash?: string;
  hasClip: boolean;
}

export interface ResultProvenance {
  mode: "live" | "mock" | "degraded";
  modelId: string | null;
}

export interface SessionSummary {
  title: string;
  steps: number;
  skips: number;
  safetyHits: number;
  skippedStepIds: string[];
  stepOutcomes?: Record<string, "unvisited" | "manual_confirmed" | "objects_visible" | "skipped">;
}

export interface UploadDraft {
  prepare: PrepareRequest;
  videoUrl: string | null;
}

export interface SessionState {
  prepare: PrepareRequest | null;
  tutorial: TutorialSteps | null;
  videoUrl: string | null;
  toolLog: ToolCall[];
  sparkLatencyMs: number | null;
  stepsSource: StepsSource | null;
  summary: SessionSummary | null;
  resultProvenance: ResultProvenance | null;
  uploadDraft: UploadDraft | null;
  persistenceNote: string | null;
}

const INITIAL_SESSION: SessionState = {
  prepare: null, tutorial: null, videoUrl: null, toolLog: [], sparkLatencyMs: null,
  stepsSource: null, summary: null, resultProvenance: null, uploadDraft: null, persistenceNote: null,
};

type SessionAction =
  | { type: "prepare"; prepare: PrepareRequest; videoUrl: string | null }
  | { type: "tutorial"; tutorial: TutorialSteps; latencyMs: number; toolCalls: ToolCall[]; source: StepsSource; expectedPrepare?: PrepareRequest; provenance?: ResultProvenance; persistenceNote?: string }
  | { type: "tools"; toolCalls: ToolCall[] }
  | { type: "summary"; summary: SessionSummary }
  | { type: "restore_draft" }
  | { type: "reset" };

/** All request-specific values reset together; async publications can assert their originating request. */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "prepare": {
      const switchingToSample = Boolean(action.prepare.sampleId) && !action.prepare.hasClip;
      const uploadDraft = switchingToSample
        ? state.prepare?.hasClip && !state.prepare.sampleId
          ? { prepare: state.prepare, videoUrl: state.videoUrl }
          : state.uploadDraft?.prepare.hasClip ? state.uploadDraft : null
        : null;
      return { ...INITIAL_SESSION, prepare: action.prepare, videoUrl: action.videoUrl, uploadDraft };
    }
    case "tutorial":
      if (action.expectedPrepare && state.prepare !== action.expectedPrepare) return state;
      return { ...state, tutorial: action.tutorial, sparkLatencyMs: action.latencyMs, toolLog: action.toolCalls, stepsSource: action.source, resultProvenance: action.provenance ?? null, persistenceNote: action.persistenceNote ?? null, summary: null };
    case "tools": return { ...state, toolLog: [...state.toolLog, ...action.toolCalls] };
    case "summary": return { ...state, summary: action.summary };
    case "restore_draft":
      return state.uploadDraft
        ? { ...INITIAL_SESSION, prepare: state.uploadDraft.prepare, videoUrl: state.uploadDraft.videoUrl }
        : state;
    case "reset": return INITIAL_SESSION;
  }
}

/** Samples keep their original lesson attribution; a user licence would overwrite it server-side. */
export function prepareSample(id: string): PrepareRequest | null {
  const sample = sampleByPublishedId(id);
  if (sample) return { key: `demo:${sample.id}`, sampleId: sample.id, hasClip: false, creatorName: sample.creatorName, domain: sample.domain, title: sample.tutorial.title };
  if (id === "aloo-jeera" || id === legacySample.tutorialId) {
    return { key: "demo:aloo-jeera", sampleId: "aloo-jeera", hasClip: false, creatorName: legacySample.attribution.creatorName, domain: "indian_recipe", title: legacySample.title };
  }
  return null;
}

interface TutorialOptions {
  expectedPrepare?: PrepareRequest;
  provenance?: ResultProvenance;
  persistenceNote?: string;
}

interface SessionValue extends SessionState {
  runtime: RuntimeInfo;
  runtimeStatus: "loading" | "ready" | "unavailable";
  setPrepare: (prepare: PrepareRequest, videoUrl: string | null) => void;
  setTutorial: (tutorial: TutorialSteps, latencyMs: number, toolCalls: ToolCall[], source: StepsSource, options?: TutorialOptions) => boolean;
  addTools: (toolCalls: ToolCall[]) => void;
  setSummary: (summary: SessionSummary) => void;
  restoreUploadDraft: () => boolean;
  reset: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function releaseUnusedUrls(previous: SessionState, next: SessionState) {
  const retained = new Set([next.videoUrl, next.uploadDraft?.videoUrl]);
  for (const url of new Set([previous.videoUrl, previous.uploadDraft?.videoUrl])) {
    if (url && !retained.has(url)) URL.revokeObjectURL(url);
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeInfo>(DEFAULT_RUNTIME);
  const [runtimeStatus, setRuntimeStatus] = useState<SessionValue["runtimeStatus"]>("loading");
  const [state, setState] = useState<SessionState>(INITIAL_SESSION);
  // This synchronous identity also protects the interval before React renders a newly selected lesson.
  const current = useRef(state);
  const update = useCallback((action: SessionAction) => {
    const previous = current.current;
    const next = sessionReducer(previous, action);
    if (next === previous) return false;
    current.current = next;
    releaseUnusedUrls(previous, next);
    setState(next);
    return true;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRuntime(controller.signal)
      .then((data) => { if (!controller.signal.aborted) { setRuntime(data); setRuntimeStatus("ready"); } })
      .catch(() => { if (!controller.signal.aborted) { setRuntime(DEFAULT_RUNTIME); setRuntimeStatus("unavailable"); } });
    return () => controller.abort();
  }, []);

  const setPrepare = useCallback((prepare: PrepareRequest, videoUrl: string | null) => { update({ type: "prepare", prepare, videoUrl }); }, [update]);
  const setTutorial = useCallback((tutorial: TutorialSteps, latencyMs: number, toolCalls: ToolCall[], source: StepsSource, options?: TutorialOptions) => update({ type: "tutorial", tutorial, latencyMs, toolCalls, source, ...options }), [update]);
  const addTools = useCallback((toolCalls: ToolCall[]) => { update({ type: "tools", toolCalls }); }, [update]);
  const setSummary = useCallback((summary: SessionSummary) => { update({ type: "summary", summary }); }, [update]);
  const restoreUploadDraft = useCallback(() => update({ type: "restore_draft" }), [update]);
  const reset = useCallback(() => { update({ type: "reset" }); }, [update]);

  const value = useMemo<SessionValue>(() => ({ ...state, runtime, runtimeStatus, setPrepare, setTutorial, addTools, setSummary, restoreUploadDraft, reset }), [state, runtime, runtimeStatus, setPrepare, setTutorial, addTools, setSummary, restoreUploadDraft, reset]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session missing");
  return value;
}
