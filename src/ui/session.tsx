"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import { SPARK_MODEL_ID, SAM_MODEL_ID } from "@/src/models";

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

export interface RuntimeInfo {
  mock: boolean;
  sparkModelId: string;
  samModelId: string;
}

export interface SessionSummary {
  title: string;
  steps: number;
  skips: number;
  safetyHits: number;
  skippedStepIds: string[];
}

interface SessionValue {
  /** True after the provider's first client commit. Redirects wait for this. */
  hydrated: boolean;
  runtime: RuntimeInfo;
  prepare: PrepareRequest | null;
  tutorial: TutorialSteps | null;
  videoUrl: string | null;
  toolLog: ToolCall[];
  sparkLatencyMs: number | null;
  stepsSource: StepsSource | null;
  summary: SessionSummary | null;
  setPrepare: (prepare: PrepareRequest, videoUrl: string | null) => void;
  setTutorial: (tutorial: TutorialSteps, latencyMs: number, toolCalls: ToolCall[], source: StepsSource) => void;
  addTools: (toolCalls: ToolCall[]) => void;
  setSummary: (summary: SessionSummary) => void;
  reset: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeInfo>({ mock: true, sparkModelId: SPARK_MODEL_ID, samModelId: SAM_MODEL_ID });
  const [prepare, setPrepareState] = useState<PrepareRequest | null>(null);
  const [tutorial, setTutorialState] = useState<TutorialSteps | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [toolLog, setToolLog] = useState<ToolCall[]>([]);
  const [sparkLatencyMs, setSparkLatencyMs] = useState<number | null>(null);
  const [stepsSource, setStepsSource] = useState<StepsSource | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const videoUrlRef = useRef(videoUrl);
  videoUrlRef.current = videoUrl;

  useEffect(() => {
    let cancel = false;
    // After this commit's queued writes, not a timer. A tutorial set in the same turn lands first.
    queueMicrotask(() => {
      if (!cancel) setHydrated(true);
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runtime")
      .then((response) => response.json())
      .then((data: RuntimeInfo) => {
        if (!cancelled) setRuntime(data);
      })
      .catch(() => {
        if (!cancelled) setRuntime({ mock: true, sparkModelId: SPARK_MODEL_ID, samModelId: SAM_MODEL_ID });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPrepare = useCallback((next: PrepareRequest, url: string | null) => {
    const current = videoUrlRef.current;
    if (current && current !== url) URL.revokeObjectURL(current);
    setPrepareState(next);
    setVideoUrl(url);
    setTutorialState(null);
    setStepsSource(null);
    setSummary(null);
  }, []);

  const setTutorial = useCallback((next: TutorialSteps, latencyMs: number, toolCalls: ToolCall[], source: StepsSource) => {
    setTutorialState(next);
    setSparkLatencyMs(latencyMs);
    setToolLog(toolCalls);
    setStepsSource(source);
  }, []);

  const addTools = useCallback((toolCalls: ToolCall[]) => {
    setToolLog((current) => [...current, ...toolCalls]);
  }, []);

  const reset = useCallback(() => {
    const current = videoUrlRef.current;
    if (current) URL.revokeObjectURL(current);
    setPrepareState(null);
    setTutorialState(null);
    setVideoUrl(null);
    setToolLog([]);
    setSparkLatencyMs(null);
    setStepsSource(null);
    setSummary(null);
  }, []);

  const value = useMemo<SessionValue>(() => ({
    hydrated,
    runtime,
    prepare,
    tutorial,
    videoUrl,
    toolLog,
    sparkLatencyMs,
    stepsSource,
    summary,
    setPrepare,
    setTutorial,
    addTools,
    setSummary,
    reset,
  }), [addTools, hydrated, prepare, reset, runtime, setPrepare, setSummary, setTutorial, sparkLatencyMs, stepsSource, summary, toolLog, tutorial, videoUrl]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session missing");
  return value;
}
