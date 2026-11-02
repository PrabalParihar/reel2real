"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sampleByPublishedId } from "@/src/domains/catalog";
import { SESSION_BUDGET_STOP_LABEL } from "@/src/coach/sam-scheduler";
import { coachStatusChip, highlightsChip, missingObjectHint, showStepPanelFrame } from "@/src/fsm/ui";
import { formatCredit } from "@/src/schema/attribution";
import { shapeClass } from "@/src/samples/frame-fit";
import { presentNouns, recordedFrameFile, recordedSampleStatus, RECORDED_SAM_LABEL, sampleFrameNote, sceneAsset, unverifiedStep, unverifiedStepHint, usesRecordedSam } from "@/src/samples/scene";
import type { PreferredLiveMode } from "@/src/schema/types";
import type { MockScenario } from "@/src/server/types";
import { AppShell, Chip } from "./chrome";
import { hidesClipTiming } from "./clip-timing";
import { coverNormalizedBox } from "./cover-box";
import { PHONE_STAND_HINT, instructHonestyChips, instructSamChip, instructSamOverlay, instructSamPhase } from "./instruct-chips";
import { stepHeadlineFontPx } from "./step-headline";
import { Filmstrip } from "./filmstrip";
import { PhotoFrame } from "./PhotoFrame";
import { SafetyNote } from "./SafetyNote";
import { SceneCredit } from "./SampleCredit";
import { useSession } from "./session";
import { useCoach } from "./useCoach";
import { StepSourceVideo } from "./StepSourceVideo";

function useCameraCover(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const [size, setSize] = useState({ viewW: 0, viewH: 0, frameW: 0, frameH: 0 });
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video || !active) return;
    const read = () => setSize({
      viewW: video.clientWidth,
      viewH: video.clientHeight,
      frameW: video.videoWidth,
      frameH: video.videoHeight,
    });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(video);
    video.addEventListener("loadedmetadata", read);
    video.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      video.removeEventListener("loadedmetadata", read);
      video.removeEventListener("resize", read);
    };
  }, [active, videoRef]);
  return size;
}

const MODES: Array<{ id: PreferredLiveMode; label: string }> = [
  { id: "keyframe_still", label: "Keyframe" },
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
  const session = useSession();
  const tutorial = session.tutorial;

  if (!tutorial) {
    return <AppShell><main className="screen"><article className="panel done-card">
      <h1>Session interrupted</h1>
      <p>This lesson is unavailable after a refresh or a direct link. Choose your source again or open a recorded Sample.</p>
      <div className="cta-row"><Link className="btn btn-primary" href="/upload">Choose a lesson</Link><Link className="btn btn-ghost" href="/#demos">Recorded Samples</Link></div>
    </article></main></AppShell>;
  }

  return <CoachBody />;
}

function CoachBody() {
  const router = useRouter();
  const session = useSession();
  const tutorial = session.tutorial!;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recordedRun = usesRecordedSam(session.stepsSource);
  const resultMock = session.resultProvenance ? session.resultProvenance.mode === "mock" : session.runtime.mock;
  const coach = useCoach(tutorial, videoRef, { mock: resultMock, recordedSample: recordedRun });
  const step = tutorial.steps[coach.machine.context.stepIndex] ?? tutorial.steps[0];
  const cameraBlocked = coach.cameraPhase === "denied" || coach.cameraPhase === "missing" || coach.cameraPhase === "insecure";
  const chip = coachStatusChip(coach.machine.state, cameraBlocked);
  const sampleSteps = resultMock || session.stepsSource === "sample" || session.stepsSource === "transcript" || session.stepsSource === "cap_sample";
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
      stepOutcomes: coach.machine.context.stepOutcomes,
    });
    router.push("/done");
  }, [coach.machine.context, coach.machine.state, router, session, tutorial.steps.length, tutorial.title]);

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
  const showRecorded = Boolean(scene) && (recordedRun || coach.cameraPhase !== "live");
  const stepIndex = coach.machine.context.stepIndex;
  const fullFrame = published?.stepFullFrame[stepIndex] === true;
  const stepCrop = fullFrame ? { x: 0.5, y: 0.5 } : published?.stepCrops[stepIndex] ?? published?.crop ?? { x: 0.5, y: 0.5 };
  const stepZoom = fullFrame ? 1 : published?.stepZooms[stepIndex] ?? published?.zoom ?? 1;
  const liveCamera = coach.cameraPhase === "live";
  const titleBelow = showRecorded && (published?.stepTitle[coach.machine.context.stepIndex] ?? "below") === "below";
  const recordedNouns = presentNouns(sceneStep);
  const verifiedNouns = recordedNouns.filter((noun) => noun.verified !== false);
  const noVerifiedMask = showRecorded && unverifiedStep(recordedNouns);
  const honesty = session.stepsSource === "instruct" ? instructHonestyChips(resultMock) : null;
  const boxDrawn = coach.masks.some((mask) => Boolean(mask.present && mask.box));
  const samPhase = instructSamPhase({
    failed: coach.samStale || coach.highlightsPaused || Boolean(highlights) || coach.machine.state === "mask_lost" || coach.machine.state === "error_recoverable",
    boxDrawn,
  });
  const samChip = session.stepsSource === "instruct" ? instructSamChip(resultMock, samPhase) : null;
  const cover = useCameraCover(videoRef, liveCamera);
  const headlinePx = session.stepsSource === "instruct" ? stepHeadlineFontPx(step.instructionText) : undefined;
  const headlineStyle = headlinePx ? { fontSize: headlinePx, lineHeight: 1.15 } : undefined;
  const hideTiming = hidesClipTiming({
    stepsSource: session.stepsSource,
    stillPlaceholder: tutorial.sourceClip.stillPlaceholder,
  });
  const recordedStatus = recordedSampleStatus(recordedRun && showRecorded, noVerifiedMask);
  const coachStatus = noVerifiedMask
    ? sampleFrameNote(true)
    : recordedRun && showRecorded
      ? recordedStatus
      : coach.highlightsPaused
        ? SESSION_BUDGET_STOP_LABEL
        : highlights
          ? highlights
          : checking
            ? "Checking…"
            : showRecorded
              ? RECORDED_SAM_LABEL
              : chip;
  const onVideoStatus = session.stepsSource === "instruct" ? instructSamOverlay(samPhase, coachStatus) : coachStatus;
  const hint = noVerifiedMask
    ? unverifiedStepHint(recordedNouns)
    : showRecorded && sceneStep && !recordedNouns.length
      ? "No highlight on this frame. Press Next when the step looks right."
      : missingObjectHint(step, coach.machine.state === "step_ready" ? null : coach.presence);

  return (
    <AppShell backHref={session.stepsSource === "instruct" ? "/instruct" : "/upload"}>
      <main className="screen coach">
        <section className={`stage-wrap${showRecorded ? " is-sample" : ""}${liveCamera ? " is-live" : ""}${titleBelow ? " title-below" : ""}`}>
          <div className={`reel-phone${fullFrame ? " is-source" : published ? ` ${shapeClass(published.shape)}` : ""}${liveCamera ? " is-live" : " is-sample"}`}>
            <video ref={videoRef} className={coach.cameraPhase === "live" ? "camera" : "camera is-hidden"} playsInline muted />
            {showRecorded && scene && sceneStep ? (
              <PhotoFrame
                className="is-fill"
                src={sceneAsset(scene, recordedFrameFile(scene, stepIndex))}
                alt={sceneStep.title}
                sizes="(max-width: 1023px) 100vw, 60vw"
                objectPosition={stepCrop}
                zoom={stepZoom}
                status={onVideoStatus}
                overlay={verifiedNouns.length ? { samUrl: sceneAsset(scene, sceneStep.samFile), nouns: verifiedNouns } : null}
              />
            ) : null}
            {!showRecorded && onVideoStatus ? <span className="reel-status">{onVideoStatus}</span> : null}
            {liveCamera || !titleBelow ? (
              <div className="reel-title">
                <p className="mono">Step {coach.machine.context.stepIndex + 1} of {tutorial.steps.length}</p>
                <h1 style={headlineStyle}>{step.instructionText}</h1>
              </div>
            ) : null}
            {coach.cameraPhase === "live" && !(session.stepsSource === "instruct" && samPhase === "failed") ? (
              <div className={`mask-layer${checking ? " is-dim" : ""}`}>
                {coach.masks.filter((mask) => mask.present && mask.box).map((mask) => {
                  const placed = coverNormalizedBox(mask.box!, cover.frameW, cover.frameH, cover.viewW, cover.viewH);
                  return (
                  <div
                    key={mask.objectId}
                    className="mask is-box"
                    role="img"
                    aria-label={`${mask.noun.replaceAll("_", " ")} box`}
                    style={{ left: `${placed.x * 100}%`, top: `${placed.y * 100}%`, width: `${placed.w * 100}%`, height: `${placed.h * 100}%` }}
                  >
                    <span>{mask.noun.replaceAll("_", " ")}</span>
                  </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          {titleBelow ? (
            <div className="reel-title is-below">
              <p className="mono">Step {coach.machine.context.stepIndex + 1} of {tutorial.steps.length}</p>
              <h1 style={headlineStyle}>{step.instructionText}</h1>
            </div>
          ) : null}
          {coach.cameraNote ? <p className="stage-note quiet">{coach.cameraNote}</p> : null}
          {coach.pauseMessage && !recordedRun ? <p className="stage-note quiet" role="status">{coach.pauseMessage}</p> : null}
        </section>

        <section className="coach-side">
          {honesty ? (
            <div className="chip-row is-start">
              <Chip tone={resultMock ? "mock" : "match"}>{honesty.plan}</Chip>
              <Chip tone={samPhase === "failed" ? "danger" : samPhase === "box" ? "mask" : "wait"}>{samChip}</Chip>
            </div>
          ) : null}
          {session.stepsSource === "instruct" ? <p className="quiet">{PHONE_STAND_HINT}</p> : null}
          {session.stepsSource === "instruct" && resultMock ? <p className="quiet">Mock client. This is not a live Muse call.</p> : null}
          {session.stepsSource === "cache" || session.stepsSource === "cap_cache" ? <p className="quiet">Cached lesson · {resultMock ? "recorded or mock extraction" : "previous live extraction"}</p> : null}
          {session.persistenceNote ? <p className="quiet" role="status">{session.persistenceNote}</p> : null}
          {published ? (
            <Filmstrip
              current={coach.machine.context.stepIndex}
              onJump={(index) => coach.dispatch({ type: "JUMP_TO_STEP", index })}
              steps={tutorial.steps.map((item, index) => ({
                id: item.id,
                title: item.instructionText,
                thumb: (
                  <PhotoFrame
                    className={published.stepFullFrame[index] ? "is-source" : shapeClass(published.shape)}
                    src={sceneAsset(published.scene, published.scene.steps[index]?.keyframe ?? published.poster)}
                    alt=""
                    objectPosition={published.stepFullFrame[index] ? { x: 0.5, y: 0.5 } : published.stepCrops[index] ?? published.crop}
                    zoom={published.stepFullFrame[index] ? 1 : published.stepZooms[index] ?? published.zoom}
                    sizes="160px"
                  />
                ),
              }))}
            />
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
            <h1 style={headlineStyle}>{step.instructionText}</h1>
            <SafetyNote note={published?.safetyNote} />
            {sceneStep && sceneStep.instruction !== step.instructionText ? <p>{sceneStep.instruction}</p> : null}
            {hint ? <p className="hint">{hint}</p> : null}
            <p className="quiet">Next confirms you performed this step. Object checks show visibility in a still frame; they do not verify the action, order or general safety.</p>
            {!hideTiming && showStepPanelFrame(showRecorded || Boolean(scene)) ? (
              <div className="clip-card">
                {clip ? (
                  <StepSourceVideo src={clip} startSec={step.sourceTimeRange.startSec} endSec={step.sourceTimeRange.endSec} />
                ) : scene && sceneStep ? (
                  <PhotoFrame
                    src={sceneAsset(scene, sceneStep.keyframe)}
                    alt={sceneStep.title}
                    sampleChip={!noVerifiedMask}
                  />
                ) : null}
                {!clip ? <p className="mono">{step.sourceTimeRange.startSec}s to {step.sourceTimeRange.endSec}s</p> : null}
              </div>
            ) : null}
            {scene ? <SceneCredit scene={scene} /> : session.stepsSource === "instruct" ? <p className="credit">Credit · You · instruction mode</p> : <p className="credit">{formatCredit({ ...tutorial.attribution, creditLine: step.credit.creditLine })}</p>}
            {coach.machine.state === "safety_halt" ? <p className="safety-copy">{step.safety?.message}</p> : null}
          </article>

          <div className="dock">
            <button type="button" className="btn btn-ghost" disabled={coach.machine.state === "safety_halt"} onClick={() => coach.dispatch({ type: "USER_SKIP" })}>Skip</button>
            <button type="button" className="btn btn-primary" disabled={coach.machine.state === "safety_halt"} onClick={() => coach.dispatch({ type: "USER_ADVANCE" })}>Next</button>
          </div>
          <div className="cta-row">
            {!recordedRun ? <button type="button" className="btn btn-ghost btn-sm" disabled={!coach.recheckAvailable} onClick={coach.recheck}>Recheck objects</button> : null}
            {cameraBlocked ? <button type="button" className="btn btn-ghost btn-sm" onClick={coach.retryCamera}>Retry camera</button> : null}
            {cameraBlocked || coach.pausedReason === "session_cap" ? <Link className="btn btn-ghost btn-sm" href="/#demos">Recorded Samples</Link> : null}
            <button type="button" className="btn btn-ghost btn-sm" aria-pressed={coach.voiceOn} onClick={() => coach.setVoiceOn((value) => !value)}>{coach.voiceOn ? "Voice on" : "Voice off"}</button>
          </div>
          {!coach.voiceAvailable ? <p className="quiet">Voice may be unavailable in this browser. Instructions remain on screen.</p> : null}
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
              {resultMock ? (
                <div className="mode-row" role="group" aria-label="Mock signals">
                  {SCENARIOS.map((item) => (
                    <button key={item.id} type="button" className={coach.scenario === item.id ? "chip tone-mask" : "chip tone-neutral"} onClick={() => coach.setScenario(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
