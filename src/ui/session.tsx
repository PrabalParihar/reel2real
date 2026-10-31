"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import { SPARK_MODEL_ID, SAM_MODEL_ID } from "@/src/models";

export type StepsSource = "clip" | "transcript" | "sample" | "cache" | "cap_cache" | "cap_sample";

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
  const [runtime, setRuntime] = useState<RuntimeInfo>({ mock: true, sparkModelId: SPARK_MODEL_ID, samModelId: SAM_MODEL_ID });
  const [prepare, setPrepareState] = useState<PrepareRequest | null>(null);
  const [tutorial, setTutorialState] = useState<TutorialSteps | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [toolLog, setToolLog] = useState<ToolCall[]>([]);
  const [sparkLatencyMs, setSparkLatencyMs] = useState<number | null>(null);
  const [stepsSource, setStepsSource] = useState<StepsSource | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

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

  const value = useMemo<SessionValue>(() => ({
    runtime,
    prepare,
    tutorial,
    videoUrl,
    toolLog,
    sparkLatencyMs,
    stepsSource,
    summary,
    setPrepare: (next, url) => {
      if (videoUrl && videoUrl !== url) URL.revokeObjectURL(videoUrl);
      setPrepareState(next);
      setVideoUrl(url);
      setTutorialState(null);
      setStepsSource(null);
      setSummary(null);
    },
    setTutorial: (next, latencyMs, toolCalls, source) => {
      setTutorialState(next);
      setSparkLatencyMs(latencyMs);
      setToolLog(toolCalls);
      setStepsSource(source);
    },
    addTools: (toolCalls) => setToolLog((current) => [...current, ...toolCalls]),
    setSummary,
    reset: () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setPrepareState(null);
      setTutorialState(null);
      setVideoUrl(null);
      setToolLog([]);
      setSparkLatencyMs(null);
      setStepsSource(null);
      setSummary(null);
    },
  }), [prepare, runtime, sparkLatencyMs, stepsSource, summary, toolLog, tutorial, videoUrl]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("Session missing");
  return value;
}
