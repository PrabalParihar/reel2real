"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sampleByPublishedId } from "@/src/domains/catalog";
import { coachStatusChip, highlightsChip, missingObjectHint, showStepPanelFrame } from "@/src/fsm/ui";
import { formatCredit } from "@/src/schema/attribution";
import { presentNouns, RECORDED_SAM_LABEL, sceneAsset } from "@/src/samples/scene";
import type { PreferredLiveMode } from "@/src/schema/types";
import type { MockScenario } from "@/src/server/types";
import { AppShell } from "./chrome";
import { PhotoFrame } from "./PhotoFrame";
import { SceneCredit } from "./SampleCredit";
import { useSession } from "./session";
import { useCoach } from "./useCoach";

const MODES: Array<{ id: PreferredLiveMode; label: string }> = [
  { id: "keyframe_still", label: "Keyframe" },
  { id: "chunk_video_1_2s", label: "Chunk" },
  { id: "stills_only", label: "Stills" },
];
const SCENARIOS: Array<{ id: MockScenario; label: string }> = [
  { id: "on_track", label: "On track" },
  { id: "skip", label: "Miss object" },
  { id: "out_of_order", label: "Out of order" },
  { id: "safety", label: "Safety" },
  { id: "mask_lost", label: "Highlight lost" },
];

export function CoachScreen() {
  const router = useRouter();
  const session = useSession();
  const tutorial = session.tutorial;

  useEffect(() => {
    if (!tutorial) router.replace("/upload");
  }, [router, tutorial]);

  if (!tutorial) {
    return <AppShell><main className="screen"><p>Opening the coach…</p></main></AppShell>;
  }

  return <CoachBody />;
}

function CoachBody() {
  const router = useRouter();
  const session = useSession();
  const tutorial = session.tutorial!;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const coach = useCoach(tutorial, videoRef, { mock: session.runtime.mock });
  const step = tutorial.steps[coach.machine.context.stepIndex] ?? tutorial.steps[0];
  const cameraBlocked = coach.cameraPhase === "denied" || coach.cameraPhase === "missing" || coach.cameraPhase === "insecure";
  const chip = coachStatusChip(coach.machine.state, cameraBlocked);
  const sampleSteps = session.runtime.mock || session.stepsSource === "sample" || session.stepsSource === "transcript" || session.stepsSource === "cap_sample";
  const highlights = highlightsChip(coach.machine.context.lastError);
  const checking = !cameraBlocked && (coach.machine.state === "tracking" || coach.machine.state === "evaluating");

  const finished = useRef(false);
  useEffect(() => {
    if (coach.machine.state !== "tutorial_complete" || finished.current) return;
    finished.current = true;
    session.setSummary({
      title: tutorial.title,
      steps: tutorial.steps.length,
      skips: coach.machine.context.skippedStepIds.length,
      safetyHits: coach.machine.context.safetyHits,
      skippedStepIds: coach.machine.context.skippedStepIds,
    });
    router.push("/done");
  }, [coach.machine.context.safetyHits, coach.machine.context.skippedStepIds.length, coach.machine.state, router, session, tutorial.steps.length, tutorial.title]);

  const clip = session.videoUrl;
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).has("debug"));
  }, []);
  const sampleVisual = !session.prepare?.hasClip && (sampleSteps || Boolean(session.prepare?.sampleId));
  const published = sampleVisual
    ? sampleByPublishedId(session.prepare?.sampleId) ?? sampleByPublishedId(tutorial.tutorialId)
    : undefined;
  const scene = published?.scene;
  const sceneStep = scene?.steps[coach.machine.context.stepIndex];
  const showRecorded = Boolean(scene) && coach.cameraPhase !== "live";
  const stepCrop = published?.stepCrops[coach.machine.context.stepIndex] ?? published?.crop ?? { x: 0.5, y: 0.5 };
  const onVideoStatus = highlights
    ? highlights
    : coach.highlightsPaused
      ? "Highlights paused"
      : checking
        ? "Checking…"
        : showRecorded
          ? RECORDED_SAM_LABEL
          : chip;
  const recordedNouns = presentNouns(sceneStep);
  const hint = showRecorded && sceneStep && !recordedNouns.length
    ? "No highlight on this frame. Press Next when the step looks right."
    : missingObjectHint(step, coach.machine.state === "step_ready" ? null : coach.presence);

  return (
    <AppShell backHref="/upload">
      <main className="screen coach">
        <section className="stage-wrap">
          <div className="reel-phone">
            <video ref={videoRef} className={coach.cameraPhase === "live" ? "camera" : "camera is-hidden"} playsInline muted />
            {showRecorded && scene && sceneStep ? (
              <PhotoFrame
                className="is-fill"
                src={sceneAsset(scene, sceneStep.keyframe)}
                alt={sceneStep.title}
                sizes="(max-width: 1023px) 100vw, 60vw"
                objectPosition={stepCrop}
                zoom={published?.zoom ?? 1}
                status={onVideoStatus}
                overlay={{ samUrl: sceneAsset(scene, sceneStep.samFile), nouns: recordedNouns }}
              />
            ) : null}
            {!showRecorded && onVideoStatus ? <span className="reel-status">{onVideoStatus}</span> : null}
            <div className="reel-title">
              <p className="mono">Step {coach.machine.context.stepIndex + 1} of {tutorial.steps.length}</p>
              <h1>{step.instructionText}</h1>
            </div>
            {coach.cameraPhase === "live" ? (
              <div className={`mask-layer${checking ? " is-dim" : ""}`}>
                {coach.masks.filter((mask) => mask.present && mask.box).map((mask) => (
                  <div
                    key={mask.objectId}
                    className="mask"
                    style={{ left: `${mask.box!.x * 100}%`, top: `${mask.box!.y * 100}%`, width: `${mask.box!.w * 100}%`, height: `${mask.box!.h * 100}%` }}
                  >
                    <span>{mask.noun.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {coach.cameraNote ? <p className="stage-note quiet">{coach.cameraNote}</p> : null}
        </section>

        <section className="coach-side">
          {published ? (
            <ol className="filmstrip">
              {tutorial.steps.map((item, index) => (
                <li key={item.id} className={index === coach.machine.context.stepIndex ? "is-current" : ""}>
                  <PhotoFrame
                    src={sceneAsset(published.scene, published.scene.steps[index]?.keyframe ?? published.poster)}
                    alt=""
                    objectPosition={{ x: 0.35, y: 0.4 }}
                    zoom={1}
                    sizes="96px"
                  />
                  <span className="film-num">{index + 1}</span>
                  {index === coach.machine.context.stepIndex ? <span className="film-title">{item.instructionText}</span> : null}
                </li>
              ))}
            </ol>
          ) : null}
          <ol className="rail">
            {tutorial.steps.map((item, index) => (
              <li key={item.id} className={index === coach.machine.context.stepIndex ? "is-current" : ""}>
                <span className="mono">{index + 1}</span>
                {item.instructionText}
              </li>
            ))}
          </ol>
          <article className="panel step-card" key={step.id}>
            <div className="step-meta">
              <p className="mono">Step {coach.machine.context.stepIndex + 1} of {tutorial.steps.length}</p>
            </div>
            <h1>{step.instructionText}</h1>
            {sceneStep && sceneStep.instruction !== step.instructionText ? <p>{sceneStep.instruction}</p> : null}
            {hint ? <p className="hint">{hint}</p> : null}
            {showStepPanelFrame(showRecorded || Boolean(scene)) ? (
              <div className="clip-card">
                {clip ? (
                  <video src={clip} muted playsInline preload="metadata" />
                ) : scene && sceneStep ? (
                  <PhotoFrame
                    src={sceneAsset(scene, sceneStep.keyframe)}
                    alt={sceneStep.title}
                    sampleChip
                  />
                ) : null}
                <p className="mono">{step.sourceTimeRange.startSec}s – {step.sourceTimeRange.endSec}s</p>
              </div>
            ) : null}
            {scene ? <SceneCredit scene={scene} /> : <p className="credit">{formatCredit({ ...tutorial.attribution, creditLine: step.credit.creditLine })}</p>}
            {coach.machine.state === "safety_halt" ? <p className="safety-copy">{step.safety?.message}</p> : null}
          </article>

          <div className="dock">
            <button type="button" className="btn btn-ghost" disabled={coach.machine.state === "safety_halt"} onClick={() => coach.dispatch({ type: "USER_SKIP" })}>Skip</button>
            <button type="button" className="btn btn-primary" disabled={coach.machine.state === "safety_halt"} onClick={() => coach.dispatch({ type: "USER_ADVANCE" })}>Next</button>
          </div>
          {coach.machine.state === "safety_halt" || coach.machine.state === "skip_detected" || coach.machine.state === "mask_lost" || coach.machine.state === "out_of_order" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => coach.dispatch({ type: "USER_RETRY" })}>Retry</button>
          ) : null}
          {debug ? (
            <div className="demo-controls">
              <p className="mono">muse-spark-1.3 · sam-3.1 · {tutorial.generation.toolCalls[0]?.purpose ?? "steps"}</p>
              <div className="mode-row" role="group" aria-label="Coaching mode">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={coach.machine.context.liveMode === mode.id ? "chip tone-saffron" : "chip tone-neutral"}
                    onClick={() => coach.dispatch({ type: "SET_LIVE_MODE", mode: mode.id })}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              {session.runtime.mock ? (
                <div className="mode-row" role="group" aria-label="Mock signals">
                  {SCENARIOS.map((item) => (
                    <button key={item.id} type="button" className={coach.scenario === item.id ? "chip tone-mask" : "chip tone-neutral"} onClick={() => coach.setScenario(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => coach.setVoiceOn((value) => !value)}>
                {coach.voiceOn ? "Voice on" : "Voice off"}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
