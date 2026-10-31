"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { capturePlan, promptsForStep } from "@/src/coach/prompts";
import { createCoach, transition } from "@/src/fsm/machine";
import { TIMEOUTS, type CoachEvent, type MachineState } from "@/src/fsm/types";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import type { MaskHit, MockScenario, SegmentResult } from "@/src/server/types";
import { voiceLine } from "@/src/voice/lines";

function grabJpeg(video: HTMLVideoElement): string | undefined {
  if (video.readyState < 2 || !video.videoWidth) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  const height = Math.round(640 * (video.videoHeight / video.videoWidth));
  canvas.height = height || 360;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
}

export function useCoach(tutorial: TutorialSteps, videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [machine, setMachine] = useState<MachineState>(() => transition(createCoach(tutorial), { type: "START_COACH" }, tutorial).machine);
  const [masks, setMasks] = useState<MaskHit[]>([]);
  const [presence, setPresence] = useState<Record<string, boolean> | null>(null);
  const [scenario, setScenario] = useState<MockScenario>("on_track");
  const [tools, setTools] = useState<ToolCall[]>(tutorial.generation.toolCalls);
  const [preview, setPreview] = useState<"starting" | "camera" | "illustrated">("starting");
  const [voiceOn, setVoiceOn] = useState(true);
  const scenarioRef = useRef(scenario);
  const phaseRef = useRef(0);
  scenarioRef.current = scenario;

  const dispatch = useCallback((event: CoachEvent) => {
    setMachine((current) => transition(current, event, tutorial).machine);
  }, [tutorial]);

  useEffect(() => {
    let cancelled = false;
    const fallback = setTimeout(() => {
      if (cancelled) return;
      setPreview((current) => (current === "starting" ? "illustrated" : current));
      dispatch({ type: "CAMERA_GRANTED" });
    }, 800);
    const request = navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: "environment" }, audio: false });
    if (!request) {
      setPreview("illustrated");
      dispatch({ type: "CAMERA_GRANTED" });
      return () => {
        cancelled = true;
        clearTimeout(fallback);
      };
    }
    request.then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
      setPreview("camera");
      dispatch({ type: "CAMERA_GRANTED" });
    }).catch(() => {
      if (cancelled) return;
      setPreview("illustrated");
      dispatch({ type: "CAMERA_GRANTED" });
    });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
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
    const controller = new AbortController();
    const plan = capturePlan(machine.context.liveMode);
    const prompts = promptsForStep(tutorial, machine.context.stepIndex);
    const timeout = setTimeout(() => dispatch({ type: "SAM_TIMEOUT" }), TIMEOUTS.SAM_TIMEOUT_MS);
    fetch("/api/segment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        inputKind: plan.inputKind,
        mediaBase64: plan.inputKind === "image" && videoRef.current ? grabJpeg(videoRef.current) : undefined,
        mimeType: plan.inputKind === "video_chunk" ? "video/mp4" : "image/jpeg",
        prompts,
        timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS,
        scenario: scenarioRef.current,
        phase: phaseRef.current,
      }),
    }).then(async (response) => {
      const data = (await response.json()) as SegmentResult;
      if (controller.signal.aborted) return;
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
      if (!controller.signal.aborted) dispatch({ type: "SAM_ERROR", message: "SAM request failed." });
    });
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [dispatch, machine.context.liveMode, machine.context.stepIndex, machine.context.tick, machine.state, tutorial, videoRef]);

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

  return { machine, masks, presence, scenario, setScenario, tools, preview, voiceOn, setVoiceOn, dispatch };
}
