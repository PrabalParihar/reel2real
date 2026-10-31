"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GATE0_REPORT } from "@/src/models";
import { AppShell, Chip } from "./chrome";
import { useSession, type PrepareRequest } from "./session";
import { sparkOnce } from "./sparkOnce";

const PHASES = ["Spark · reading clip", "Spark · writing steps", "Curating objects"];

export function ExtractingScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const demo = params.get("demo");

  useEffect(() => {
    if (!demo || session.prepare) return;
    const sampleId = demo === "bike-chain" ? "bike-chain" : demo === "aloo-jeera" ? "aloo-jeera" : "masala-chai";
    const prepare: PrepareRequest = {
      key: `demo:${sampleId}`,
      sampleId,
      creditLine: "Sample · Self-filmed for Reel2Real demo — not a public creator Reel",
      domain: sampleId === "bike-chain" ? "non_cooking_diy" : "indian_recipe",
      title: sampleId === "bike-chain" ? "Sample · Bike chain wipe" : sampleId === "aloo-jeera" ? "Sample · Aloo jeera — onion prep" : "Sample · Masala chai",
    };
    session.setPrepare(prepare, null);
  }, [demo, session]);

  useEffect(() => {
    if (!session.prepare && !demo) router.replace("/upload");
  }, [demo, router, session.prepare]);

  useEffect(() => {
    if (!session.prepare) return;
    const started = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - started), 100);
    return () => clearInterval(timer);
  }, [session.prepare]);

  useEffect(() => {
    const prepare = session.prepare;
    if (!prepare || error) return;
    const request = attempt ? { ...prepare, key: `${prepare.key}:retry${attempt}` } : prepare;
    let cancelled = false;
    sparkOnce(request).then((result) => {
      if (cancelled) return;
      if (!result.schemaValid || !result.tutorial) {
        if (attempt < 1) {
          setAttempt(1);
          return;
        }
        setError(result.errors[0] || "The steps JSON did not validate.");
        return;
      }
      session.setTutorial(result.tutorial, result.latencyMs, result.toolCalls);
      router.push("/coach");
    }).catch(() => {
      if (!cancelled) setError("Spark did not return steps.");
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, error, router, session, session.prepare]);

  const phase = elapsed < 900 ? 0 : elapsed < 1900 ? 1 : 2;
  const progress = Math.min(92, (elapsed / 9000) * 92);

  return (
    <AppShell backHref="/upload" mock={session.runtime.mock}>
      <main className="screen extract">
        <section className="extract-stage panel">
          <div className="ring" style={{ ["--progress" as string]: progress }}>
            <strong className="mono">{(elapsed / 1000).toFixed(1)}s</strong>
            <span>this run</span>
          </div>
          <p className="mono">{session.runtime.sparkModelId}</p>
          {session.runtime.mock ? <Chip tone="mock">Mock</Chip> : <Chip tone="running">Spark</Chip>}
          <p className="quiet">
            {session.runtime.mock
              ? "Mock client. This is not a live Spark call."
              : `Gate 0 reported Spark at ${GATE0_REPORT.sparkLatencyNote}. The clock above is this run.`}
          </p>
        </section>
        <section>
          <ol className="capsules">
            {PHASES.map((label, index) => {
              const state = index < phase ? "done" : index === phase ? "running" : "wait";
              return (
                <li key={label} className={`capsule is-${state}`} style={{ animationDelay: `${index * 30}ms` }}>
                  <Chip tone={state === "done" ? "match" : state === "running" ? "running" : "neutral"} pulse={state === "running"}>{state === "running" ? "Running" : state === "done" ? "Done" : "Wait"}</Chip>
                  {label}
                </li>
              );
            })}
          </ol>
          <ul className="skeleton" aria-hidden="true">
            <li />
            <li />
            <li />
          </ul>
          {error ? (
            <div className="panel error-panel">
              <h1>Steps did not validate</h1>
              <p>{error}</p>
              {attempt > 0 ? <p className="mono">Retried once.</p> : null}
              <Link className="btn btn-primary" href="/upload">Back to upload</Link>
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
