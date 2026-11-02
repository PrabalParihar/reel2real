"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { classifyCameraError, openRearCamera, type CameraBlock } from "@/src/coach/camera";
import { grabInstructJpeg } from "@/src/coach/keyframe";
import { screenGoal } from "@/src/safety/goal-screen";
import { AppShell } from "./chrome";
import { PHONE_STAND_HINT } from "./instruct-chips";
import { INSTRUCT_GOALS, instructCameraBusyMessage, instructPrimary, instructProgress, planStepsEnabled } from "./instruct-flow";
import { LiveCoachingOff } from "./LiveCoachingOff";
import { SampleCoachStill } from "./SampleCoachStill";
import { useSession } from "./session";
import { createCameraAcquisition } from "./camera-acquisition";
import { interpretInstructResponse } from "./instruct-result";
import { hasReadableInstructFrame, observeInstructPreview } from "./instruct-preview";

type CameraPhase = "idle" | "opening" | "live" | "failed" | CameraBlock;

export function InstructScreen() {
  const router = useRouter();
  const session = useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const camera = useRef(createCameraAcquisition());
  const cameraPending = useRef(false);
  const previewDispose = useRef<(() => void) | null>(null);
  const planningRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<CameraPhase>("idle");
  const [previewReady, setPreviewReady] = useState(false);
  const [cameraIssue, setCameraIssue] = useState<{ title: string; message: string } | null>(null);
  const [still, setStill] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [coachingOff, setCoachingOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const unavailable = session.runtime.capabilities?.instruct !== true;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      previewDispose.current?.();
      previewDispose.current = null;
      camera.current.stop();
      if (videoRef.current) videoRef.current.srcObject = null;
      planningRequest.current?.abort();
      planningRequest.current = null;
      streamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!unavailable) return;
    stopCamera();
    cameraPending.current = false;
    planningRequest.current?.abort();
    setPhase("idle");
  }, [unavailable]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || phase !== "live" || !stream || unavailable) return;
    setPreviewReady(false);
    video.srcObject = stream;
    const dispose = observeInstructPreview(video, {
      onReady: () => {
        if (mounted.current && streamRef.current === stream) setPreviewReady(true);
      },
      onTimeout: () => {
        if (!mounted.current || streamRef.current !== stream) return;
        stopCamera();
        setCameraIssue({ title: "Camera didn't start", message: "The camera opened but no readable frame arrived. Retry the camera or choose a recorded sample." });
        setPhase("failed");
      },
    });
    previewDispose.current = dispose;
    return () => {
      dispose();
      if (previewDispose.current === dispose) previewDispose.current = null;
    };
  }, [phase, unavailable]);

  function stopCamera() {
    previewDispose.current?.();
    previewDispose.current = null;
    setPreviewReady(false);
    camera.current.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function allowCamera() {
    if (cameraPending.current || planningRequest.current || unavailable) return;
    cameraPending.current = true;
    setNote(null);
    setError(null);
    setRefusal(null);
    setStill(null);
    setCameraIssue(null);
    setPreviewReady(false);
    setPhase("opening");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setPhase("insecure");
      cameraPending.current = false;
      return;
    }
    try {
      stopCamera();
      const stream = await camera.current.acquire((signal) => openRearCamera((constraints) => navigator.mediaDevices.getUserMedia(constraints), signal));
      if (!stream || !mounted.current) return;
      streamRef.current = stream;
      setPhase("live");
    } catch (cause) {
      if (!mounted.current) return;
      const timedOut = cause instanceof Error && cause.message.includes("timed out");
      const busyMessage = instructCameraBusyMessage(cause);
      if (timedOut || busyMessage) {
        setCameraIssue({ title: busyMessage ? "Camera is in use" : "Camera didn't start", message: busyMessage ?? (cause as Error).message });
        setPhase("failed");
      } else {
        setPhase(classifyCameraError(cause));
      }
    } finally {
      cameraPending.current = false;
    }
  }

  function captureStill() {
    if (phase !== "live" || !previewReady || cameraPending.current || planningRequest.current || unavailable) return;
    const video = videoRef.current;
    if (!video || !hasReadableInstructFrame(video)) return;
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
    if (planningRequest.current || cameraPending.current || unavailable) return;
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
    const controller = new AbortController();
    planningRequest.current = controller;
    setPlanning(true);
    setNote(null);
    setError(null);
    setRefusal(null);
    setCoachingOff(false);
    const timer = setTimeout(() => controller.abort(), 45_000);
    const interrupted = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new Error("Planning took too long or was cancelled. Your goal and still are saved here; try again or choose a recorded sample.")), { once: true });
    });
    try {
      const result = await Promise.race([(async () => {
        const response = await fetch("/api/instruct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: trimmed, imageDataUrl: still, mimeType: "image/jpeg" }),
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        return { response, data };
      })(), interrupted]);
      if (!mounted.current || planningRequest.current !== controller || controller.signal.aborted) return;
      const outcome = interpretInstructResponse(result.data, result.response.ok);
      if (outcome.kind === "refusal") {
        setRefusal(outcome.reason);
        return;
      }
      if (outcome.kind === "off") {
        setCoachingOff(true);
        return;
      }
      if (outcome.kind === "error") {
        setError(outcome.message);
        return;
      }
      const data = outcome.result;
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
      session.setTutorial(data.tutorial, data.latencyMs, data.toolCalls, "instruct", { provenance: { mode: data.mode, modelId: data.modelId } });
      router.push("/coach");
    } catch (cause) {
      if (mounted.current && planningRequest.current === controller) setError(controller.signal.aborted ? "Planning took too long or was cancelled. Try again or choose a recorded sample." : cause instanceof Error && cause.name !== "SyntaxError" ? cause.message : "The service returned an unreadable plan. Try again.");
    } finally {
      clearTimeout(timer);
      if (planningRequest.current === controller) { planningRequest.current = null; if (mounted.current) setPlanning(false); }
    }
  }

  const blocked = phase === "denied" || phase === "missing" || phase === "insecure" || phase === "failed";
  const hasStill = Boolean(still);
  const ready = planStepsEnabled(goal, hasStill) && !unavailable;
  const primary = instructPrimary({ cameraLive: phase === "live", hasStill, goal });
  const progress = instructProgress(goal, hasStill);
  const blockedCopy = cameraIssue?.message ?? (phase === "denied"
    ? "Camera permission is blocked. Allow the camera in the browser, then try again."
    : phase === "insecure"
      ? "Camera needs a secure page (https)."
      : "No camera was found. Use a phone or laptop with a camera.");

  return (
    <AppShell backHref="/" appearance="studio">
      <main className={`screen instruct-screen${coachingOff ? " is-off" : ""}`}>
        {coachingOff ? <LiveCoachingOff goal={goal} onEdit={() => setCoachingOff(false)} /> : null}
        {coachingOff ? null : <>
        <p className="kicker">No tutorial clip needed</p>
        <h1>Start from a goal + camera</h1>
        <p className="lead">Describe a task and capture your workspace to create a plan.</p>
        {unavailable ? <p className="capability-note" role="status">{session.runtimeStatus === "loading" ? "Checking camera planning availability. " : "Camera planning is unavailable in this environment. "}<Link href="/extracting?demo=masala-chai">Try a recorded sample without a camera</Link>.</p> : null}
        {session.runtime.capabilities?.segment === false && !unavailable ? <p className="capability-note">Live object highlights are unavailable here. You can still follow a plan and move through it yourself.</p> : null}
        <p className="quiet">The camera preview and captured still stay on this device until you choose Plan steps. That sends the still and your goal to the configured AI service. Live coaching sends workspace images for object highlights; those checks do not verify technique or safety.</p>
        <p className="quiet">{PHONE_STAND_HINT}</p>
        <ol className="instruct-progress" aria-label="Progress">
          {progress.map((step) => (
            <li key={step.id} className={`is-${step.state}`}>{step.id}</li>
          ))}
        </ol>
        <div className="instruct-layout">
          <section className="instruct-form">
            <label className="field-label" htmlFor="instruct-goal">
              Goal (required)
              <input
                id="instruct-goal"
                className="field"
                value={goal}
                placeholder="I want to make chai"
                maxLength={240}
                required
                disabled={planning}
                aria-describedby="instruct-status"
                onChange={(event) => setGoal(event.target.value)}
              />
            </label>
            <div className="goal-chips" role="group" aria-label="Example goals">
              {INSTRUCT_GOALS.map((label) => (
                <button
                  key={label}
                  type="button"
                  className={goal === label ? "chip tone-saffron" : "chip tone-neutral"}
                  aria-pressed={goal === label}
                  disabled={planning}
                  onClick={() => setGoal(label)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="instruct-actions">
              {phase === "live" ? (
                <button className={primary === "capture" ? "btn btn-primary" : "btn btn-ghost"} type="button" disabled={planning || !previewReady || unavailable} onClick={captureStill}>Capture still</button>
              ) : (
                <button className={primary === "allow" ? "btn btn-primary" : "btn btn-ghost"} type="button" disabled={phase === "opening" || planning || unavailable} onClick={() => void allowCamera()}>
                  {phase === "opening" ? "Opening camera…" : blocked ? "Retry camera" : still ? "Retake workspace still" : "Allow camera"}
                </button>
              )}
              <button className={primary === "plan" ? "btn btn-primary" : "btn btn-ghost"} type="button" disabled={!ready || planning} onClick={() => void planSteps()}>
                {planning ? "Planning steps" : "Plan steps"}
              </button>
              {planning ? <button className="btn btn-ghost" type="button" onClick={() => planningRequest.current?.abort()}>Cancel planning</button> : null}
            </div>
            <Link className="quiet" href="/extracting?demo=masala-chai">Try a recorded sample without a camera</Link>
            <div id="instruct-status" aria-live="polite" aria-busy={planning || phase === "opening" || (phase === "live" && !previewReady)}>
              {note ? <p className="form-note">{note}</p> : null}
              {phase === "opening" ? <p className="form-note">Opening the camera…</p> : null}
              {phase === "live" && !previewReady ? <p className="form-note">Starting camera preview… Capture will be available when a frame is ready.</p> : null}
              {!ready && !note ? <p className="form-note">{unavailable ? "Choose a recorded sample to begin." : blocked ? "Retry the camera or open a recorded sample below." : phase === "opening" ? "Allow camera access in your browser. You can leave this page while it opens." : phase === "live" && !previewReady ? "Wait for the camera preview, or choose a recorded sample." : !goal.trim() ? "Enter a goal, then capture one still." : "Capture a still of your workspace to continue."}</p> : null}
              {planning ? <p className="form-note">Creating your plan… This may take up to 45 seconds.</p> : null}
            </div>
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
                <button className="btn btn-primary" type="button" disabled={!ready || planning} onClick={() => void planSteps()}>Try again</button>
                <Link className="btn btn-ghost" href="/extracting?demo=masala-chai">Try a recorded sample</Link>
              </div>
            ) : null}
          </section>
          <section className="instruct-stage panel" aria-label="Camera">
            <div className="reel-phone instruct-live" hidden={phase !== "opening" && phase !== "live"}>
              <video ref={videoRef} className="instruct-video" aria-label="Workspace camera preview" playsInline muted autoPlay />
              {phase === "opening" || (phase === "live" && !previewReady) ? <p className="instruct-preview-status">{phase === "opening" ? "Waiting for camera access…" : "Starting camera preview…"}</p> : null}
            </div>
            {still && phase !== "live" ? (
              <figure className="sample-coach">
                <div className="reel-phone">
                  <img className="instruct-shot" src={still} alt="Captured workspace still" />
                </div>
              </figure>
            ) : null}
            {blocked ? (
              <div className="instruct-block">
                <h2>{cameraIssue?.title ?? (phase === "denied" ? "Camera access is blocked" : phase === "insecure" ? "Camera needs a secure page" : "No camera found")}</h2>
                <p>{blockedCopy}</p>
                <Link className="btn btn-primary" href="/extracting?demo=masala-chai">Try a recorded sample without a camera</Link>
              </div>
            ) : null}
            {phase !== "live" && phase !== "opening" && !still && !blocked ? <SampleCoachStill /> : null}
          </section>
        </div>
        </>}
      </main>
    </AppShell>
  );
}
