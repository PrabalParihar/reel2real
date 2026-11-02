"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cameraBlockMessage, classifyCameraError, openRearCamera, shouldPollSam, type CameraBlock } from "@/src/coach/camera";
import { grabJpeg } from "@/src/coach/keyframe";
import { segmentPrompts } from "@/src/coach/prompts";
import { decideSamPoll, initialSamSchedulerState, markSamSettled, readSamSchedulerConfig, resetStepCalls, sessionBudgetHardStop, type SamPauseReason } from "@/src/coach/sam-scheduler";
import { createCoach, transition } from "@/src/fsm/machine";
import { TIMEOUTS, type CoachEvent, type MachineState } from "@/src/fsm/types";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import type { MaskHit, MockScenario } from "@/src/server/types";
import { voiceLine } from "@/src/voice/lines";
import { readyCoachCamera } from "./coach-camera";
import { runSegmentCheck, SegmentCheckScope } from "./segment-check";

export type CameraPhase = "starting" | "live" | "mock" | CameraBlock;
type PauseReason = SamPauseReason | "camera" | "frame" | "error" | "stale";
const PAUSE_MESSAGES: Record<PauseReason, string> = {
  hidden: "Object checks pause while this tab is hidden.",
  step_done: "Objects visible. Confirm the action yourself, or recheck the frame.",
  error_recoverable: "Object checks are unavailable. Recheck or continue manually.",
  session_cap: "Session check budget reached. Continue manually or choose a recorded Sample.",
  step_cap: "Checks paused for this step. Recheck objects or confirm the step yourself.",
  camera: "Camera unavailable. Retry camera or continue manually.",
  frame: "Camera did not produce a frame. Retry camera or continue manually.",
  error: "Object check failed. Recheck or continue manually.",
  stale: "The previous highlight expired. Recheck for current object visibility.",
};
const OVERLAY_MAX_AGE_MS = 10_000;

function secureCameraAvailable(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useCoach(
  tutorial: TutorialSteps,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: { mock?: boolean; recordedSample?: boolean } = {},
) {
  const [machine, setMachine] = useState<MachineState>(() => {
    const started = transition(createCoach(tutorial), { type: "START_COACH" }, tutorial).machine;
    // Learner confirmation remains usable while camera permission is pending.
    return transition(started, { type: "CAMERA_GRANTED" }, tutorial).machine;
  });
  const machineRef = useRef(machine);
  const [masks, setMasks] = useState<MaskHit[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean> | null>(null);
  const [scenario, setScenario] = useState<MockScenario>("on_track");
  const [tools, setTools] = useState<ToolCall[]>(tutorial.generation.toolCalls);
  const [cameraPhase, setCameraPhase] = useState<CameraPhase>("starting");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);
  const [samStale, setSamStale] = useState(false);
  const [evidenceAt, setEvidenceAt] = useState<number | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const scenarioRef = useRef(scenario);
  const phaseRef = useRef(0);
  const schedulerRef = useRef(initialSamSchedulerState());
  const checksRef = useRef(new SegmentCheckScope());
  const configRef = useRef(readSamSchedulerConfig({
    NEXT_PUBLIC_SAM_MIN_INTERVAL_MS: process.env.NEXT_PUBLIC_SAM_MIN_INTERVAL_MS,
    NEXT_PUBLIC_SAM_SESSION_CAP: process.env.NEXT_PUBLIC_SAM_SESSION_CAP,
    NEXT_PUBLIC_SAM_STEP_CAP: process.env.NEXT_PUBLIC_SAM_STEP_CAP,
  }));
  scenarioRef.current = scenario;

  const clearEvidence = useCallback(() => {
    setMasks([]);
    setPresence(null);
    setEvidenceAt(null);
  }, []);

  const dispatch = useCallback((event: CoachEvent) => {
    const current = machineRef.current;
    const next = transition(current, event, tutorial).machine;
    if (next === current) return;
    if (event.type === "USER_RETRY" || event.type === "JUMP_TO_STEP" || event.type === "USER_ADVANCE" || event.type === "USER_SKIP" || event.type === "USER_PAUSE" || event.type === "SET_LIVE_MODE") {
      checksRef.current.cancel();
      schedulerRef.current = markSamSettled(schedulerRef.current);
      clearEvidence();
      setSamStale(false);
      setPauseReason(null);
      if (event.type === "USER_RETRY") schedulerRef.current = resetStepCalls(schedulerRef.current);
    }
    machineRef.current = next;
    setMachine(next);
  }, [clearEvidence, tutorial]);

  const recheck = useCallback(() => {
    if (sessionBudgetHardStop(schedulerRef.current.calls, configRef.current.sessionCap)) {
      setPauseReason("session_cap");
      return;
    }
    dispatch({ type: "USER_RETRY" });
  }, [dispatch]);

  const retryCamera = useCallback(() => {
    checksRef.current.cancel();
    schedulerRef.current = markSamSettled(schedulerRef.current);
    clearEvidence();
    setCameraAttempt((attempt) => attempt + 1);
    recheck();
  }, [clearEvidence, recheck]);

  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.hidden);
      if (document.hidden) {
        checksRef.current.cancel();
        schedulerRef.current = markSamSettled(schedulerRef.current);
        clearEvidence();
        setPauseReason("hidden");
      }
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearEvidence]);

  useEffect(() => {
    let cancelled = false;
    const debug = new URLSearchParams(window.location.search).has("debug");
    const streamRef = { current: null as MediaStream | null };
    const readyController = new AbortController();
    const listeners: Array<() => void> = [];
    let acquisitionTimer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      listeners.forEach((remove) => remove());
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    if (options.recordedSample) {
      return () => { cancelled = true; };
    }
    if (debug && options.mock) {
      setCameraPhase("mock");
      return () => { cancelled = true; stop(); };
    }
    if (!secureCameraAvailable()) {
      setCameraPhase("insecure");
      setPauseReason("camera");
      return () => { cancelled = true; };
    }
    setCameraPhase("starting");
    acquisitionTimer = setTimeout(() => {
      cancelled = true;
      readyController.abort();
      stop();
      setCameraPhase("missing");
      setPauseReason("frame");
    }, TIMEOUTS.SAM_TIMEOUT_MS);
    openRearCamera((constraints) => navigator.mediaDevices.getUserMedia(constraints), readyController.signal)
      .then(async (stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview is unavailable.");
        await readyCoachCamera(video, stream, { timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS, signal: readyController.signal });
        if (cancelled) return;
        clearTimeout(acquisitionTimer);
        const interrupted = () => {
          checksRef.current.cancel();
          schedulerRef.current = markSamSettled(schedulerRef.current);
          clearEvidence();
          setCameraPhase("missing");
          setPauseReason("camera");
        };
        for (const track of stream.getVideoTracks()) {
          track.addEventListener("ended", interrupted);
          track.addEventListener("mute", interrupted);
          const resumed = () => setCameraAttempt((attempt) => attempt + 1);
          track.addEventListener("unmute", resumed);
          listeners.push(() => { track.removeEventListener("ended", interrupted); track.removeEventListener("mute", interrupted); track.removeEventListener("unmute", resumed); });
        }
        setCameraPhase("live");
        setPauseReason(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        clearTimeout(acquisitionTimer);
        stop();
        setCameraPhase(classifyCameraError(error));
        setPauseReason("camera");
      });
    return () => {
      cancelled = true;
      clearTimeout(acquisitionTimer);
      readyController.abort();
      stop();
    };
  }, [cameraAttempt, clearEvidence, options.mock, options.recordedSample, videoRef]);

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
    schedulerRef.current = resetStepCalls(schedulerRef.current);
    clearEvidence();
    setSamStale(false);
    setPauseReason(null);
  }, [clearEvidence, machine.context.stepIndex]);

  useEffect(() => {
    if (evidenceAt == null) return;
    const timer = setTimeout(() => {
      clearEvidence();
      setSamStale(true);
      setPauseReason("stale");
    }, OVERLAY_MAX_AGE_MS);
    return () => clearTimeout(timer);
  }, [clearEvidence, evidenceAt]);

  useEffect(() => {
    if (machine.state !== "tracking") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let check: ReturnType<SegmentCheckScope["begin"]> | null = null;
    const config = configRef.current;
    const startedWaiting = performance.now();
    const stamp = { stepIndex: machine.context.stepIndex, tick: machine.context.tick };
    const attempt = () => {
      if (cancelled || options.recordedSample) return;
      if (!shouldPollSam(cameraPhase)) { setPauseReason("camera"); return; }
      const decision = decideSamPoll({ now: performance.now(), state: schedulerRef.current, hidden: document.hidden, stepDone: false, coachState: machine.state, config });
      if (decision.action === "pause") { setPauseReason(decision.reason); return; }
      if (decision.action === "wait") { timer = setTimeout(attempt, decision.waitMs); return; }
      const frame = cameraPhase === "live" && videoRef.current ? grabJpeg(videoRef.current) : undefined;
      if (cameraPhase === "live" && !frame) {
        if (performance.now() - startedWaiting >= TIMEOUTS.SAM_TIMEOUT_MS) {
          clearEvidence();
          setCameraPhase("missing");
          setPauseReason("frame");
          return;
        }
        timer = setTimeout(attempt, 250);
        return;
      }
      schedulerRef.current = decision.state;
      check = checksRef.current.begin();
      const currentCheck = check;
      setPauseReason(null);
      // grabJpeg captures a still regardless of generated runtime hints.
      void runSegmentCheck((signal) => fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ inputKind: "image", mediaBase64: frame, mimeType: "image/jpeg", prompts: segmentPrompts(tutorial, stamp.stepIndex), timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS, scenario: scenarioRef.current, phase: phaseRef.current }),
      }), { signal: currentCheck.signal, timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS }).then((data) => {
        if (cancelled || !currentCheck.isCurrent()) return;
        if (data.timedOut) throw new DOMException("Object check timed out.", "TimeoutError");
        if (!data.ok || data.mode === "degraded") throw new Error(data.error || "Object check unavailable.");
        phaseRef.current += 1;
        if (data.toolCall.modelId) setTools((current) => [...current, { ...data.toolCall, modelId: data.toolCall.modelId as string }]);
        const map: Record<string, boolean> = {};
        for (const mask of data.masks) map[mask.objectId] = mask.present;
        setSamStale(false);
        setMasks(data.masks);
        setPresence(map);
        setEvidenceAt(performance.now());
        dispatch({ type: "SAM_RESULT", presence: map, ...stamp });
      }).catch((error: unknown) => {
        if (cancelled || !currentCheck.isCurrent()) return;
        clearEvidence();
        setSamStale(true);
        setPauseReason("error");
        if (error instanceof Error && error.name === "TimeoutError") dispatch({ type: "SAM_TIMEOUT", ...stamp });
        else dispatch({ type: "SAM_ERROR", message: "Object check unavailable. Recheck or continue manually.", ...stamp });
      }).finally(() => {
        if (currentCheck.isCurrent()) {
          schedulerRef.current = markSamSettled(schedulerRef.current);
          currentCheck.finish();
        }
      });
    };
    attempt();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (check?.isCurrent()) {
        checksRef.current.cancel();
        schedulerRef.current = markSamSettled(schedulerRef.current);
      }
    };
  }, [cameraPhase, clearEvidence, dispatch, hidden, machine.context.stepIndex, machine.context.tick, machine.state, options.recordedSample, tutorial, videoRef]);

  useEffect(() => {
    setVoiceAvailable(Boolean(window.speechSynthesis));
    try { setVoiceOn(sessionStorage.getItem("reel2real:voice") !== "off"); } catch { /* Preference storage is optional. */ }
    setVoiceLoaded(true);
    return () => window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    if (!voiceLoaded) return;
    try { sessionStorage.setItem("reel2real:voice", voiceOn ? "on" : "off"); } catch { /* Preference storage is optional. */ }
    if (!voiceOn || !voiceAvailable) { window.speechSynthesis?.cancel(); return; }
    const step = tutorial.steps[machine.context.stepIndex] ?? null;
    const line = machine.state === "success" ? "Objects visible. Confirm the step yourself." : voiceLine(machine.state, step);
    if (!line) return;
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [machine.context.stepIndex, machine.state, tutorial.steps, voiceAvailable, voiceLoaded, voiceOn]);

  const cameraNote = options.recordedSample || cameraPhase === "live" ? null : cameraPhase === "starting" ? "Camera starting. You can confirm steps manually while it connects." : cameraPhase === "mock" ? "Illustrated stand · mock checks" : cameraBlockMessage(cameraPhase);
  return { machine, masks, presence, scenario, setScenario, tools, cameraPhase, cameraNote, highlightsPaused: pauseReason != null, pausedReason: pauseReason, pauseMessage: pauseReason ? PAUSE_MESSAGES[pauseReason] : null, samStale, voiceOn, setVoiceOn, voiceAvailable, dispatch, recheck, retryCamera, recheckAvailable: !options.recordedSample && (cameraPhase === "live" || cameraPhase === "mock") && !sessionBudgetHardStop(schedulerRef.current.calls, configRef.current.sessionCap) };
}
