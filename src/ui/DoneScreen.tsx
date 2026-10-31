"use client";

import Link from "next/link";
import { coachHonesty } from "@/src/fsm/ui";
import { formatCredit } from "@/src/schema/attribution";
import { AppShell, Chip } from "./chrome";
import { StillFrame } from "./StandScene";
import { useSession } from "./session";

export function DoneScreen() {
  const session = useSession();
  const summary = session.summary;
  const tutorial = session.tutorial;
  const sampleSteps = session.runtime.mock || session.stepsSource === "sample" || session.stepsSource === "transcript" || session.stepsSource === "cap_sample";
  const kind = tutorial?.domain === "non_cooking_diy" ? "bike" : "chai";
  const showTiming = !session.runtime.mock && session.stepsSource === "clip" && session.sparkLatencyMs != null && session.sparkLatencyMs > 0;
  return (
    <AppShell mock={session.runtime.mock}>
      <main className="screen done">
        <article className="panel done-card">
          <div className="chip-row">
            <Chip tone="match">{coachHonesty(tutorial?.runtimeHints?.preferredLiveMode ?? "keyframe_still", tutorial?.runtimeHints?.preferredLiveMode === "stills_only", sampleSteps)}</Chip>
          </div>
          <h1>{summary?.title ?? tutorial?.title ?? "Session complete"}</h1>
          <ul className="counts">
            <li><strong>{summary?.steps ?? tutorial?.steps.length ?? 0}</strong><span>steps</span></li>
            <li><strong>{summary?.skips ?? 0}</strong><span>skips</span></li>
            <li><strong>{summary?.safetyHits ?? 0}</strong><span>safety hits</span></li>
          </ul>
          {tutorial ? (
            <ol className="recap">
              {tutorial.steps.map((step, index) => {
                const skipped = summary?.skippedStepIds?.includes(`index:${index}`) ?? false;
                return (
                  <li key={step.id}>
                    <StillFrame kind={kind} />
                    <div>
                      <p>{step.instructionText}</p>
                      <span>{skipped ? "Skipped" : "Done"}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <p className="credit">{tutorial ? formatCredit(tutorial.attribution) : "Credit · Sample cook · self-filmed"}</p>
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
