"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { honestyChip, missingObjectHint, stateChip } from "@/src/fsm/ui";
import type { PreferredLiveMode } from "@/src/schema/types";
import type { MockScenario } from "@/src/server/types";
import { AppShell, Chip } from "./chrome";
import { StandScene, StillFrame } from "./StandScene";
import { useSession } from "./session";
import { useCoach } from "./useCoach";

const TINTS = ["teal", "violet", "amber", "rose"];
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
  { id: "mask_lost", label: "Mask lost" },
];

export function CoachScreen() {
  const router = useRouter();
  const session = useSession();
  const tutorial = session.tutorial;

  useEffect(() => {
    if (!tutorial) router.replace("/upload");
  }, [router, tutorial]);

  if (!tutorial) {
    return <AppShell mock={session.runtime.mock}><main className="screen"><p>Opening the coach…</p></main></AppShell>;
  }

  return <CoachBody />;
}

function CoachBody() {
  const router = useRouter();
  const session = useSession();
  const tutorial = session.tutorial!;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const coach = useCoach(tutorial, videoRef);
  const step = tutorial.steps[coach.machine.context.stepIndex] ?? tutorial.steps[0];
  const chip = stateChip(coach.machine.state);
  const modeChip = honestyChip(coach.machine.context.liveMode, coach.machine.context.stillsArmed);
  const hint = missingObjectHint(step, coach.machine.state === "step_ready" ? null : coach.presence);
  const checking = coach.machine.state === "tracking" || coach.machine.state === "evaluating";
  const tone = coach.machine.state === "safety_halt" ? "danger" : coach.machine.state === "skip_detected" || coach.machine.state === "out_of_order" ? "skip" : coach.machine.state === "success" ? "match" : checking ? "running" : "wait";

  const finished = useRef(false);
  useEffect(() => {
    if (coach.machine.state !== "tutorial_complete" || finished.current) return;
    finished.current = true;
    session.setSummary({
      title: tutorial.title,
      steps: tutorial.steps.length,
      skips: coach.machine.context.skippedStepIds.length,
      safetyHits: coach.machine.context.safetyHits,
    });
    router.push("/done");
  }, [coach.machine.context.safetyHits, coach.machine.context.skippedStepIds.length, coach.machine.state, router, session, tutorial.steps.length, tutorial.title]);

  const clip = session.videoUrl;
  const [controlsOpen, setControlsOpen] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("debug")) setControlsOpen(true);
  }, []);
  const stillKind = tutorial.domain === "non_cooking_diy" ? "bike" : "chai";

  return (
    <AppShell backHref="/upload" mock={session.runtime.mock}>
      <main className="screen coach">
        <section className="stage-wrap mesh">
          <div className="stage">
            <div className="stage-chips">
              <Chip tone="wait">{modeChip}</Chip>
              {session.stepsSource === "clip" && !session.runtime.mock ? <Chip>Steps from clip · muse-spark-1.3</Chip> : null}
              {session.stepsSource === "cache" ? <Chip>Cached</Chip> : null}
              {session.stepsSource === "cap_cache" ? <Chip tone="wait">Daily cap reached · Cached</Chip> : null}
              {session.stepsSource === "cap_sample" ? <Chip tone="wait">Daily cap reached · Sample</Chip> : null}
              {session.stepsSource === "transcript" || session.stepsSource === "sample" ? <Chip>Steps from transcript (Sample)</Chip> : tutorial.sampleLabel ? <Chip>Sample</Chip> : null}
              {session.runtime.mock ? <Chip tone="mock">Mock</Chip> : null}
            </div>
            <video ref={videoRef} className={coach.preview === "camera" ? "camera" : "camera is-hidden"} playsInline muted />
            {coach.preview !== "camera" ? <StandScene /> : null}
            <div className={`mask-layer${checking ? " is-dim" : ""}`}>
              {coach.masks.filter((mask) => mask.present && mask.box).map((mask, index) => (
                <div
                  key={mask.objectId}
                  className={`mask tint-${TINTS[index % 4]}`}
                  style={{ left: `${mask.box!.x * 100}%`, top: `${mask.box!.y * 100}%`, width: `${mask.box!.w * 100}%`, height: `${mask.box!.h * 100}%` }}
                >
                  <span>{mask.noun.replaceAll("_", " ")}</span>
                </div>
              ))}
            </div>
            {coach.preview === "illustrated" ? <p className="stage-note mono">Illustrated stand · camera unavailable</p> : null}
          </div>
        </section>

        <section className="coach-side">
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
              {chip ? <Chip tone={tone} pulse={checking}>{chip}</Chip> : null}
            </div>
            <h1>{step.instructionText}</h1>
            {hint ? <p className="hint">{hint}</p> : null}
            <div className="clip-card">
              {clip ? (
                <video src={clip} muted playsInline preload="metadata" />
              ) : (
                <StillFrame kind={stillKind} />
              )}
              <p className="mono">{step.sourceTimeRange.startSec}s – {step.sourceTimeRange.endSec}s</p>
            </div>
            <p className="credit">Credit · {step.credit.creditLine}</p>
            {coach.machine.state === "safety_halt" ? <p className="safety-copy">{step.safety?.message}</p> : null}
            <div className="tool-log mono">
              <p>muse-spark-1.3 · {tutorial.generation.toolCalls[0]?.purpose ?? "steps"}</p>
              <p>sam-3.1 · {coach.machine.context.liveMode === "chunk_video_1_2s" ? "video_chunk" : "image"}{coach.tools.at(-1)?.latencyMs != null && coach.tools.at(-1)?.tool === "sam_3_1" ? ` · ${coach.tools.at(-1)?.latencyMs} ms` : ""}</p>
            </div>
          </article>

          <div className="dock">
            <button type="button" className="btn btn-ghost" disabled={coach.machine.state === "safety_halt"} onClick={() => coach.dispatch({ type: "USER_SKIP" })}>Skip</button>
            <button type="button" className="btn btn-primary" disabled={coach.machine.state === "safety_halt"} onClick={() => coach.dispatch({ type: "USER_ADVANCE" })}>Next</button>
          </div>
          <details
            className="demo-controls"
            open={controlsOpen}
            onToggle={(event) => setControlsOpen(event.currentTarget.open)}
          >
            <summary>Demo controls</summary>
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
            {coach.machine.context.liveMode === "chunk_video_1_2s" ? (
              <p className="quiet">Optional. Gate 0 measured 2213 ms to the first mask on a 2s chunk.</p>
            ) : null}
            {session.runtime.mock ? (
              <div className="mode-row" role="group" aria-label="Mock signals">
                {SCENARIOS.map((item) => (
                  <button key={item.id} type="button" className={coach.scenario === item.id ? "chip tone-mask" : "chip tone-neutral"} onClick={() => coach.setScenario(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </details>
          <div className="voice-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => coach.setVoiceOn((value) => !value)}>
              {coach.voiceOn ? "Voice on" : "Voice off"}
            </button>
            {coach.machine.state === "safety_halt" || coach.machine.state === "skip_detected" || coach.machine.state === "mask_lost" || coach.machine.state === "out_of_order" ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => coach.dispatch({ type: "USER_RETRY" })}>Retry</button>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
