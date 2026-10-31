"use client";

import Link from "next/link";
import { sampleByPublishedId } from "@/src/domains/catalog";
import { coachHonesty } from "@/src/fsm/ui";
import { formatCredit } from "@/src/schema/attribution";
import { sceneAsset } from "@/src/samples/scene";
import { AppShell, Chip } from "./chrome";
import { PhotoFrame } from "./PhotoFrame";
import { SampleCredit, SceneCredit } from "./SampleCredit";
import { useSession } from "./session";

export function DoneScreen() {
  const session = useSession();
  const summary = session.summary;
  const tutorial = session.tutorial;
  const sampleSteps = session.runtime.mock || session.stepsSource === "sample" || session.stepsSource === "transcript" || session.stepsSource === "cap_sample";
  const published = !session.prepare?.hasClip
    ? sampleByPublishedId(session.prepare?.sampleId) ?? sampleByPublishedId(tutorial?.tutorialId)
    : undefined;
  const scene = published?.scene;
  const showTiming = !session.runtime.mock && session.stepsSource === "clip" && session.sparkLatencyMs != null && session.sparkLatencyMs > 0;
  return (
    <AppShell>
      <main className="screen done">
        <article className="panel done-card">
          <div className="chip-row">
            <Chip tone="match">{coachHonesty(tutorial?.runtimeHints?.preferredLiveMode ?? "keyframe_still", tutorial?.runtimeHints?.preferredLiveMode === "stills_only", sampleSteps)}</Chip>
          </div>
          <h1>{summary?.title ?? tutorial?.title ?? "Session complete"}</h1>
          {tutorial ? (
            <ol className="recap-reel">
              {tutorial.steps.map((step, index) => {
                const skipped = summary?.skippedStepIds?.includes(`index:${index}`) ?? false;
                const crop = published?.stepCrops[index] ?? published?.crop;
                return (
                  <li key={step.id}>
                    <div className="reel-tile">
                      {scene?.steps[index] ? (
                        <PhotoFrame
                          className="is-fill"
                          src={sceneAsset(scene, scene.steps[index].keyframe)}
                          alt={scene.steps[index].title}
                          sizes="140px"
                          objectPosition={crop}
                        />
                      ) : null}
                    </div>
                    <p>{step.instructionText}</p>
                    <span>{skipped ? "Skipped" : "Done"}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <ul className="counts counts-quiet">
            <li><strong>{summary?.steps ?? tutorial?.steps.length ?? 0}</strong><span>steps</span></li>
            <li><strong>{summary?.skips ?? 0}</strong><span>skips</span></li>
            <li><strong>{summary?.safetyHits ?? 0}</strong><span>safety hits</span></li>
          </ul>
          {scene ? <SceneCredit scene={scene} /> : <p className="credit">{tutorial ? formatCredit(tutorial.attribution) : "Credit · Sample cook · self-filmed"}</p>}
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
