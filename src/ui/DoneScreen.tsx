"use client";

import Link from "next/link";
import { sampleByPublishedId } from "@/src/domains/catalog";
import { coachHonesty } from "@/src/fsm/ui";
import { formatCredit } from "@/src/schema/attribution";
import { shapeClass } from "@/src/samples/frame-fit";
import { sceneAsset } from "@/src/samples/scene";
import { hidesClipTiming } from "./clip-timing";
import { AppShell, Chip } from "./chrome";
import { PhotoFrame } from "./PhotoFrame";
import { SampleCredit, SceneCredit } from "./SampleCredit";
import { useSession } from "./session";

export function DoneScreen() {
  const session = useSession();
  const summary = session.summary;
  const tutorial = session.tutorial;
  if (!summary || !tutorial) {
    return (
      <AppShell appearance="studio">
        <main className="screen done"><article className="panel done-card">
          <h1>No completed session</h1>
          <p>This session is unavailable after a refresh or a direct link. Start a lesson to create a recap.</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/upload">Choose a lesson</Link>
            <Link className="btn btn-ghost" href="/#demos">Recorded Samples</Link>
          </div>
        </article></main>
      </AppShell>
    );
  }
  const resultMock = session.resultProvenance ? session.resultProvenance.mode === "mock" : session.runtime.mock;
  const sampleSteps = resultMock || session.stepsSource === "sample" || session.stepsSource === "transcript" || session.stepsSource === "cap_sample";
  const published = !session.prepare?.hasClip
    ? sampleByPublishedId(session.prepare?.sampleId) ?? sampleByPublishedId(tutorial?.tutorialId)
    : undefined;
  const scene = published?.scene;
  const showTiming = !resultMock
    && session.stepsSource === "clip"
    && !hidesClipTiming({ stepsSource: session.stepsSource, stillPlaceholder: tutorial?.sourceClip.stillPlaceholder })
    && session.sparkLatencyMs != null
    && session.sparkLatencyMs > 0;
  return (
    <AppShell appearance="studio">
      <main className="screen done">
        <article className="panel done-card">
          <div className="chip-row">
            <Chip tone="match">{coachHonesty(tutorial.runtimeHints?.preferredLiveMode === "stills_only" ? "stills_only" : "keyframe_still", tutorial.runtimeHints?.preferredLiveMode === "stills_only", sampleSteps)}</Chip>
          </div>
          <h1>{summary.title}</h1>
          <p className="quiet">Object visibility does not verify the action, technique or general safety. Next records your own confirmation.</p>
          {tutorial ? (
            <ol className="recap-reel">
              {tutorial.steps.map((step, index) => {
                const outcome = summary.stepOutcomes?.[step.id] ?? (summary.skippedStepIds.includes(`index:${index}`) ? "skipped" : "unvisited");
                const label = outcome === "manual_confirmed" ? "You confirmed" : outcome === "objects_visible" ? "Objects visible" : outcome === "skipped" ? "Skipped" : "Unvisited";
                const crop = published?.stepCrops[index] ?? published?.crop;
                return (
                  <li key={step.id}>
                    <div className={`reel-tile${published?.stepFullFrame[index] ? " is-source" : published ? ` ${shapeClass(published.shape)}` : ""}`}>
                      {scene?.steps[index] ? (
                        <PhotoFrame
                          className="is-fill"
                          src={sceneAsset(scene, scene.steps[index].keyframe)}
                          alt={scene.steps[index].title}
                          sizes="140px"
                          objectPosition={published?.stepFullFrame[index] ? { x: 0.5, y: 0.5 } : crop}
                          zoom={published?.stepFullFrame[index] ? 1 : published?.stepZooms[index] ?? published?.zoom ?? 1}
                        />
                      ) : null}
                    </div>
                    <p>{step.instructionText}</p>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <ul className="counts counts-quiet">
            <li><strong>{Object.values(summary.stepOutcomes ?? {}).filter((outcome) => outcome === "manual_confirmed" || outcome === "objects_visible").length}</strong><span>visited steps</span></li>
            <li><strong>{summary?.skips ?? 0}</strong><span>skips</span></li>
            <li><strong>{summary?.safetyHits ?? 0}</strong><span>configured safety cues</span></li>
          </ul>
          {scene ? <SceneCredit scene={scene} /> : <p className="credit">{formatCredit(tutorial.attribution)}</p>}
          {scene ? <SampleCredit /> : null}
          <div className="cta-row">
            <Link className="btn btn-primary" href="/coach">Run again</Link>
            <Link className="btn btn-ghost" href="/upload" onClick={() => session.reset()}>Upload another</Link>
          </div>
          {showTiming ? <p className="quiet">Spark {session.sparkLatencyMs} ms this session</p> : null}
        </article>
      </main>
    </AppShell>
  );
}
