"use client";

import Link from "next/link";
import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { AppShell, Chip } from "./chrome";
import { StillFrame } from "./StandScene";
import { useSession } from "./session";

export function DoneScreen() {
  const session = useSession();
  const summary = session.summary;
  const tutorial = session.tutorial;
  return (
    <AppShell mock={session.runtime.mock}>
      <main className="screen done mesh">
        <article className="panel done-card">
          <Chip tone="match">Done</Chip>
          {session.stepsSource === "clip" && !session.runtime.mock ? <Chip>Steps from clip · muse-spark-1.3</Chip> : null}
          {session.stepsSource === "cache" ? <Chip>Cached</Chip> : null}
          {session.stepsSource === "cap_cache" ? <Chip tone="wait">Daily cap reached · Cached</Chip> : null}
          {session.stepsSource === "cap_sample" ? <Chip tone="wait">Daily cap reached · Sample</Chip> : null}
          {session.stepsSource === "transcript" || session.stepsSource === "sample" ? <Chip>Steps from transcript (Sample)</Chip> : null}
          {tutorial?.sampleLabel ? <Chip>Sample</Chip> : null}
          {session.runtime.mock ? <Chip tone="mock">Mock</Chip> : null}
          <h1>{summary?.title ?? tutorial?.title ?? "Session complete"}</h1>
          <ul className="counts">
            <li><strong>{summary?.steps ?? tutorial?.steps.length ?? 0}</strong><span>steps</span></li>
            <li><strong>{summary?.skips ?? 0}</strong><span>skips</span></li>
            <li><strong>{summary?.safetyHits ?? 0}</strong><span>safety hits</span></li>
          </ul>
          {session.videoUrl ? <video className="replay" src={session.videoUrl} controls playsInline /> : <StillFrame kind={tutorial?.domain === "non_cooking_diy" ? "bike" : "chai"} tall />}
          <p className="credit">Credit · {tutorial?.attribution.creditLine ?? "Sample · self-filmed"}</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/coach">Run again</Link>
            <Link className="btn btn-ghost" href="/upload" onClick={() => session.reset()}>Upload another</Link>
          </div>
          <p className="mono footnote">
            {SPARK_MODEL_ID} · {SAM_MODEL_ID}
            {session.sparkLatencyMs != null ? ` · Spark ${session.sparkLatencyMs} ms this session` : ""}
          </p>
        </article>
      </main>
    </AppShell>
  );
}
