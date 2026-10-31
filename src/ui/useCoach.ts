"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraBlockMessage, classifyCameraError, openRearCamera, shouldPollSam, type CameraBlock } from "@/src/coach/camera";
import { grabJpeg } from "@/src/coach/keyframe";
import { capturePlan, promptsForStep } from "@/src/coach/prompts";
import {
  decideSamPoll,
  initialSamSchedulerState,
  markSamSettled,
  readSamSchedulerConfig,
  type SamSchedulerState,
} from "@/src/coach/sam-scheduler";
import { createCoach, transition } from "@/src/fsm/machine";
import { TIMEOUTS, type CoachEvent, type MachineState } from "@/src/fsm/types";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import type { MaskHit, MockScenario, SegmentResult } from "@/src/server/types";
import { voiceLine } from "@/src/voice/lines";

export type CameraPhase = "starting" | "live" | "mock" | CameraBlock;

function secureCameraAvailable(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useCoach(
  tutorial: TutorialSteps,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: { mock?: boolean } = {},
) {
  const [machine, setMachine] = useState<MachineState>(() => transition(createCoach(tutorial), { type: "START_COACH" }, tutorial).machine);
  const [masks, setMasks] = useState<MaskHit[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean> | null>(null);
  const [scenario, setScenario] = useState<MockScenario>("on_track");
  const [tools, setTools] = useState<ToolCall[]>(tutorial.generation.toolCalls);
  const [cameraPhase, setCameraPhase] = useState<CameraPhase>("starting");
  const [highlightsPaused, setHighlightsPaused] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [hidden, setHidden] = useState(false);
  const scenarioRef = useRef(scenario);
  const phaseRef = useRef(0);
  const schedulerRef = useRef<SamSchedulerState>(initialSamSchedulerState());
  const configRef = useRef(readSamSchedulerConfig({
    NEXT_PUBLIC_SAM_MIN_INTERVAL_MS: process.env.NEXT_PUBLIC_SAM_MIN_INTERVAL_MS,
    NEXT_PUBLIC_SAM_SESSION_CAP: process.env.NEXT_PUBLIC_SAM_SESSION_CAP,
  }));
  const mockRef = useRef(Boolean(options.mock));
  scenarioRef.current = scenario;
  mockRef.current = Boolean(options.mock);

  const dispatch = useCallback((event: CoachEvent) => {
    setMachine((current) => transition(current, event, tutorial).machine);
  }, [tutorial]);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const debug = new URLSearchParams(window.location.search).has("debug");
    const streamRef = { current: null as MediaStream | null };
    const stop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    if (debug) {
      setCameraPhase("mock");
      dispatch({ type: "CAMERA_GRANTED" });
      return () => {
        cancelled = true;
        stop();
      };
    }
    if (!secureCameraAvailable()) {
      setCameraPhase("insecure");
      dispatch({ type: "CAMERA_GRANTED" });
      return () => {
        cancelled = true;
      };
    }
    openRearCamera((constraints) => navigator.mediaDevices.getUserMedia(constraints))
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
        setCameraPhase("live");
        dispatch({ type: "CAMERA_GRANTED" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCameraPhase(classifyCameraError(error));
        dispatch({ type: "CAMERA_GRANTED" });
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [dispatch, videoRef]);

  useEffect(() => {
    if (machine.state !== "step_ready") return;
    const timer = setTimeout(() => dispatch({ type: "READY" }), 400);
    return () => clearTimeout(timer);
  }, [dispatch, machine.context.stepIndex, machine.state]);

  useEffect(() => {
    if (machine.state !== "waiting" && machine.state !== "mask_lost") return;
    const delay = machine.state === "mask_lost" || machine.context.armImmediate ? 0 : TIMEOUTS.CADENCE_MS;
    const timer = setTimeout(() => dispatch({ type: "CADENCE_TICK" }), delay);
    return () => clearTimeout(timer);
  }, [dispatch, machine.context.armImmediate, machine.context.tick, machine.state]);

  useEffect(() => {
    if (machine.state !== "tracking") return;
    let cancelled = false;
    let timer = 0;
    let controller: AbortController | null = null;
    const config = configRef.current;

    const attempt = () => {
      if (cancelled) return;
      if (!shouldPollSam(cameraPhase)) return;
      const frame = cameraPhase === "live" && videoRef.current ? grabJpeg(videoRef.current) : undefined;
      if (cameraPhase === "live" && !frame) {
        timer = window.setTimeout(attempt, 250);
        return;
      }
      const decision = decideSamPoll({
        now: performance.now(),
        state: schedulerRef.current,
        hidden: document.hidden,
        stepDone: false,
        coachState: machine.state,
        config,
      });
      if (decision.action === "pause") {
        if (decision.reason === "session_cap") setHighlightsPaused(true);
        return;
      }
      if (decision.action === "wait") {
        timer = window.setTimeout(attempt, decision.waitMs);
        return;
      }
      schedulerRef.current = decision.state;
      controller = new AbortController();
      const plan = capturePlan(machine.context.liveMode);
      const prompts = promptsForStep(tutorial, machine.context.stepIndex);
      const timeout = window.setTimeout(() => {
        if (!cancelled) dispatch({ type: "SAM_TIMEOUT" });
      }, TIMEOUTS.SAM_TIMEOUT_MS);
      fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          inputKind: plan.inputKind,
          mediaBase64: frame,
          mimeType: "image/jpeg",
          prompts,
          timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS,
          scenario: scenarioRef.current,
          phase: phaseRef.current,
        }),
      }).then(async (response) => {
        const data = (await response.json()) as SegmentResult;
        if (cancelled || controller?.signal.aborted) return;
        phaseRef.current += 1;
        setTools((current) => [...current, data.toolCall]);
        if (data.timedOut) {
          dispatch({ type: "SAM_TIMEOUT" });
          return;
        }
        if (!data.ok) {
          dispatch({ type: "SAM_ERROR", message: data.error || "SAM request failed." });
          return;
        }
        const map: Record<string, boolean> = {};
        for (const mask of data.masks) map[mask.objectId] = mask.present;
        setMasks(data.masks);
        setPresence(map);
        dispatch({ type: "SAM_RESULT", presence: map });
      }).catch(() => {
        if (!cancelled && !controller?.signal.aborted) dispatch({ type: "SAM_ERROR", message: "SAM request failed." });
      }).finally(() => {
        window.clearTimeout(timeout);
        schedulerRef.current = markSamSettled(schedulerRef.current);
      });
    };

    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller?.abort();
      schedulerRef.current = markSamSettled(schedulerRef.current);
    };
  }, [cameraPhase, dispatch, hidden, machine.context.liveMode, machine.context.stepIndex, machine.context.tick, machine.state, options.mock, tutorial, videoRef]);

  useEffect(() => {
    if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
    const step = tutorial.steps[machine.context.stepIndex] ?? null;
    const line = voiceLine(machine.state, step);
    if (!line) return;
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [machine.context.stepIndex, machine.state, tutorial.steps, voiceOn]);

  const cameraNote = cameraPhase === "live" || cameraPhase === "starting"
    ? null
    : cameraPhase === "mock"
      ? "Illustrated stand"
      : cameraBlockMessage(cameraPhase);

  return {
    machine,
    masks,
    presence,
    scenario,
    setScenario,
    tools,
    cameraPhase,
    cameraNote,
    highlightsPaused,
    voiceOn,
    setVoiceOn,
    dispatch,
  };
}
