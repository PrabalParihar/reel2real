"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openRearCamera, type CameraBlock } from "@/src/coach/camera";
import { grabInstructJpeg } from "@/src/coach/keyframe";
import type { SparkResult } from "@/src/server/types";
import { modelRefusalReason, screenGoal } from "@/src/safety/goal-screen";
import { AppShell } from "./chrome";
import { PHONE_STAND_HINT } from "./instruct-chips";
import { INSTRUCT_GOALS, CAMERA_FAILED_COPY, CAMERA_FRAME_TIMEOUT_MS, CAMERA_STARTING_LABEL, instructPrimary, instructProgress, instructVideoReady, planStepsEnabled } from "./instruct-flow";
import { isLiveCoachingOff, LiveCoachingOff, SAMPLES_HREF } from "./LiveCoachingOff";
import { SampleCoachStill } from "./SampleCoachStill";
import { useSession } from "./session";

type CameraPhase = "idle" | "opening" | "live" | CameraBlock;

interface InstructResponse extends SparkResult {
  refused?: boolean;
  reason?: string;
  message?: string;
}

export function InstructScreen() {
  const router = useRouter();
  const session = useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [still, setStill] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [coachingOff, setCoachingOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const readyTimer = useRef<number | null>(null);
  const detachVideo = useRef<(() => void) | null>(null);

  function clearReadyTimer() {
    if (readyTimer.current == null) return;
    window.clearTimeout(readyTimer.current);
    readyTimer.current = null;
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function failCamera() {
    clearReadyTimer();
    detachVideo.current?.();
    detachVideo.current = null;
    stopCamera();
    setFrameReady(false);
    setCameraFailed(true);
    setPhase("idle");
  }

  function armReadyTimer() {
    clearReadyTimer();
    readyTimer.current = window.setTimeout(() => {
      readyTimer.current = null;
      if (instructVideoReady(videoRef.current)) {
        setFrameReady(true);
        setCameraFailed(false);
        return;
      }
      failCamera();
    }, CAMERA_FRAME_TIMEOUT_MS);
  }

  function attachStream(video: HTMLVideoElement, stream: MediaStream) {
    detachVideo.current?.();
    const mark = () => {
      if (!instructVideoReady(video)) return;
      clearReadyTimer();
      setFrameReady(true);
      setCameraFailed(false);
    };
    const events = ["loadeddata", "loadedmetadata", "canplay", "resize"] as const;
    for (const name of events) video.addEventListener(name, mark);
    detachVideo.current = () => {
      for (const name of events) video.removeEventListener(name, mark);
    };
    video.srcObject = stream;
    mark();
    const playback = video.play();
    if (playback) {
      void playback.catch(() => {
        if (!instructVideoReady(video)) failCamera();
      });
    }
  }

  function takeVideo(node: HTMLVideoElement | null) {
    videoRef.current = node;
    if (!node) {
      detachVideo.current?.();
      detachVideo.current = null;
      return;
    }
    const stream = streamRef.current;
    if (!stream) return;
    attachStream(node, stream);
  }

  useEffect(() => {
    return () => {
      clearReadyTimer();
      detachVideo.current?.();
      detachVideo.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  async function allowCamera() {
    clearReadyTimer();
    setCameraFailed(false);
    setFrameReady(false);
    setNote(null);
    setError(null);
    setRefusal(null);
    setStill(null);
    setPhase("opening");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraFailed(true);
      setPhase("idle");
      return;
    }
    try {
      stopCamera();
      const stream = await openRearCamera((constraints) => navigator.mediaDevices.getUserMedia(constraints));
      streamRef.current = stream;
      armReadyTimer();
      setPhase("live");
    } catch {
      failCamera();
    }
  }

  function captureStill() {
    const video = videoRef.current;
    if (!video || !instructVideoReady(video)) {
      setNote("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    const shot = grabInstructJpeg(video);
    if (!shot) {
      setNote("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    setStill(shot);
    setNote(null);
    stopCamera();
    setPhase("idle");
  }

  async function planSteps() {
    const trimmed = goal.trim();
    if (!trimmed) {
      setNote("Enter a goal.");
      setError(null);
      setRefusal(null);
      return;
    }
    if (!still) {
      setNote("Capture a still of your workspace first.");
      setError(null);
      setRefusal(null);
      return;
    }
    const screened = screenGoal(trimmed);
    if (screened) {
      setRefusal(screened.reason);
      setError(null);
      setNote(null);
      return;
    }
    setPlanning(true);
    setNote(null);
    setError(null);
    setRefusal(null);
    setCoachingOff(false);
    try {
      const response = await fetch("/api/instruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: trimmed, imageDataUrl: still, mimeType: "image/jpeg" }),
      });
      const data = (await response.json()) as InstructResponse;
      const refusal = modelRefusalReason({
        refused: data.refused,
        reason: data.reason,
        refusalReason: data.refusalReason,
        message: data.message,
        errors: data.errors,
      });
      if (refusal) {
        setRefusal(refusal);
        return;
      }
      if (isLiveCoachingOff(data)) {
        setCoachingOff(true);
        return;
      }
      if (!response.ok || !data.schemaValid || !data.tutorial) {
        setError(data.message || data.errors?.[0] || "Spark did not return a plan.");
        return;
      }
      session.setPrepare({
        key: `instruct:${trimmed}:${data.latencyMs}`,
        hasClip: false,
        title: trimmed,
        domain: "other",
        creatorName: "You",
        licenceChoice: "self_filmed",
        transcript: trimmed,
        mimeType: "image/jpeg",
      }, null);
      session.setTutorial(data.tutorial, data.latencyMs, data.toolCalls, "instruct");
      router.push("/coach");
    } catch {
      setError("Spark did not return a plan.");
    } finally {
      setPlanning(false);
    }
  }

  const blocked = phase === "denied" || phase === "missing" || phase === "insecure";
  const hasStill = Boolean(still);
  const ready = planStepsEnabled(goal, hasStill);
  const primary = instructPrimary({ cameraLive: phase === "live", hasStill, goal });
  const progress = instructProgress(goal, hasStill);
  const blockedCopy = phase === "denied"
    ? "Camera permission is blocked. Allow the camera in the browser, then try again."
    : phase === "insecure"
      ? "Camera needs a secure page (https)."
      : "No camera was found. Use a phone or laptop with a camera.";

  return (
    <AppShell backHref="/">
      <main className={`screen instruct-screen${coachingOff ? " is-off" : ""}`}>
        {coachingOff ? <LiveCoachingOff goal={goal} onEdit={() => setCoachingOff(false)} /> : null}
        {coachingOff ? null : <>
        <p className="kicker">No tutorial</p>
        <h1>Instruction mode</h1>
        <p className="lead">Type a goal. The camera takes one still, then the coach checks your workspace.</p>
        <p className="quiet">{PHONE_STAND_HINT}</p>
        <ol className="instruct-progress" aria-label="Progress">
          {progress.map((step) => (
            <li key={step.id} className={`is-${step.state}`}>{step.id}</li>
          ))}
        </ol>
        <div className="instruct-layout">
          <section className="instruct-form">
            <label className="field-label" htmlFor="instruct-goal">
              Goal
              <input
                id="instruct-goal"
                className="field"
                value={goal}
                placeholder="I want to make chai"
                maxLength={240}
                onChange={(event) => setGoal(event.target.value)}
              />
            </label>
            <div className="goal-chips" role="group" aria-label="Example goals">
              {INSTRUCT_GOALS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={goal === label ? "chip tone-saffron" : "chip tone-neutral"}
                  onClick={() => setGoal(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="instruct-actions">
              {phase === "live" ? (
                <button
                  className={frameReady && primary === "capture" ? "btn btn-primary" : "btn btn-ghost"}
                  type="button"
                  disabled={!frameReady}
                  aria-disabled={frameReady ? "false" : "true"}
                  onClick={captureStill}
                >
                  {frameReady ? "Capture still" : CAMERA_STARTING_LABEL}
                </button>
              ) : cameraFailed ? null : (
                <button className={primary === "allow" ? "btn btn-primary" : "btn btn-ghost"} type="button" onClick={() => void allowCamera()}>
                  {blocked || still ? "Allow camera again" : "Allow camera"}
                </button>
              )}
              <button className={primary === "plan" ? "btn btn-primary" : "btn btn-ghost"} type="button" disabled={!ready || planning} onClick={() => void planSteps()}>
                {planning ? "Planning steps" : "Plan steps"}
              </button>
            </div>
            <div aria-live="polite">
              {phase === "live" && !frameReady ? <p className="form-note">{CAMERA_STARTING_LABEL}</p> : null}
              {note ? <p className="form-note">{note}</p> : null}
              {phase === "opening" ? <p className="form-note">Opening the camera…</p> : null}
              {!ready && !note && phase !== "live" ? <p className="form-note">Enter a goal, then capture one still.</p> : null}
            </div>
            {cameraFailed ? (
              <div className="panel error-panel" role="alert">
                <h2>Camera didn't start</h2>
                <p>{CAMERA_FAILED_COPY}</p>
                <button className="btn btn-primary" type="button" onClick={() => void allowCamera()}>Try again</button>
                <Link className="btn btn-primary" href={SAMPLES_HREF}>Try a Sample</Link>
              </div>
            ) : null}
            {refusal ? (
              <div className="panel error-panel" role="status">
                <h2>Cannot coach this goal</h2>
                <p>{refusal}</p>
                <p>Try a safe household task, like making tea or folding a shirt.</p>
              </div>
            ) : null}
            {error ? (
              <div className="panel error-panel" role="alert">
                <h2>Plan did not start</h2>
                <p>{error}</p>
                <button className="btn btn-primary" type="button" disabled={!ready} onClick={() => void planSteps()}>Try again</button>
              </div>
            ) : null}
          </section>
          <section className="instruct-stage panel" aria-label="Camera">
            {phase === "live" ? (
              <div className="reel-phone instruct-live">
                <video ref={takeVideo} className="instruct-video" playsInline muted autoPlay />
              </div>
            ) : null}
            {still && phase !== "live" ? (
              <figure className="sample-coach">
                <div className="reel-phone">
                  <img className="instruct-shot" src={still} alt="Captured workspace still" />
                </div>
              </figure>
            ) : null}
            {blocked ? (
              <div className="instruct-block">
                <h2>{phase === "denied" ? "Camera permission denied" : phase === "insecure" ? "Camera needs a secure page" : "No camera found"}</h2>
                <p>{blockedCopy}</p>
              </div>
            ) : null}
            {phase !== "live" && !still && !blocked ? <SampleCoachStill /> : null}
          </section>
        </div>
        </>}
      </main>
    </AppShell>
  );
}
