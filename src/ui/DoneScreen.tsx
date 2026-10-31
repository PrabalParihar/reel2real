"use client";

import Link from "next/link";
import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { AppShell, Chip } from "./chrome";
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
          {tutorial?.sampleLabel ? <Chip>Sample</Chip> : null}
          {session.runtime.mock ? <Chip tone="mock">Mock</Chip> : null}
          <h1>{summary?.title ?? tutorial?.title ?? "Session complete"}</h1>
          <ul className="counts">
            <li><strong>{summary?.steps ?? tutorial?.steps.length ?? 0}</strong><span>steps</span></li>
            <li><strong>{summary?.skips ?? 0}</strong><span>skips</span></li>
            <li><strong>{summary?.safetyHits ?? 0}</strong><span>safety hits</span></li>
          </ul>
          {session.videoUrl ? <video className="replay" src={session.videoUrl} controls playsInline /> : <div className="filmstrip tall"><span>No clip file in this session</span></div>}
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
