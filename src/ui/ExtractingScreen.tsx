"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell, Chip } from "./chrome";
import { useSession, prepareSample } from "./session";
import type { ExtractStage } from "./sparkOnce";
import { PUBLISHED_SAMPLES, sampleByPublishedId } from "@/src/domains/catalog";
import { heroNouns, heroSamFile, heroStep, sceneAsset } from "@/src/samples/scene";
import { PhotoFrame } from "./PhotoFrame";
import { LiveCoachingOff } from "./LiveCoachingOff";
import { extractPreparedLesson, extractionReducer, initialExtraction, extractionStageLabel, canRetryExtraction, MAX_PREPARATION_RETRIES } from "./extraction-run";

export function ExtractingScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const { prepare, setPrepare, setTutorial } = session;
  const [run, dispatch] = useReducer(extractionReducer, null, initialExtraction);
  const selectedDemo = useRef<string | null>(null);
  const demo = params.get("demo");
  const requestedSample = demo ? prepareSample(demo) : null;
  const unknownDemo = Boolean(demo && !requestedSample);
  const matchesSelection = !demo || Boolean(requestedSample && prepare?.sampleId === requestedSample.sampleId && !prepare?.hasClip);

  useEffect(() => {
    if (selectedDemo.current === demo) return;
    selectedDemo.current = demo;
    if (!demo) return;
    const sample = prepareSample(demo);
    if (sample) setPrepare(sample, null);
  }, [demo, setPrepare]);

  useEffect(() => {
    if (!prepare && !demo) router.replace("/upload");
  }, [demo, router, prepare]);

  useEffect(() => {
    dispatch({ type: "start", prepare: matchesSelection ? prepare : null });
  }, [prepare, matchesSelection]);

  const activeRun = run.prepare === prepare && matchesSelection;
  const terminal = Boolean(run.error || run.refusal || run.coachingOff || run.capped);
  useEffect(() => {
    if (!prepare || !activeRun || terminal) return;
    const started = performance.now();
    const timer = setInterval(() => dispatch({ type: "elapsed", prepare, elapsed: performance.now() - started }), 100);
    return () => clearInterval(timer);
  }, [prepare, activeRun, terminal]);

  useEffect(() => {
    if (!prepare || !activeRun || terminal || unknownDemo) return;
    const controller = new AbortController();
    extractPreparedLesson(prepare, { signal: controller.signal, onStage: (stage) => { if (!controller.signal.aborted) dispatch({ type: "stage", prepare, stage }); } })
      .then((result) => {
        if (controller.signal.aborted) return;
        switch (result.kind) {
          case "refusal": dispatch({ type: "refusal", prepare, message: result.message }); return;
          case "invalid": dispatch({ type: "invalid", prepare, message: result.message }); return;
          case "off": dispatch({ type: "off", prepare }); return;
          case "cap": dispatch({ type: "cap", prepare }); return;
          case "tutorial": {
            dispatch({ type: "stage", prepare, stage: "preparing" });
            if (setTutorial(result.tutorial, result.latencyMs, result.toolCalls, result.source, { expectedPrepare: prepare, provenance: result.provenance, persistenceNote: result.persistenceNote })) router.push("/coach");
          }
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: "error", prepare, message: error instanceof Error ? error.message : "Spark did not return steps." });
      });
    return () => controller.abort();
  }, [prepare, activeRun, terminal, unknownDemo, run.attempt, run.manualRetries, router, setTutorial]);

  const published = sampleByPublishedId(demo) ?? sampleByPublishedId(prepare?.sampleId);
  const heroFile = published ? heroSamFile(published.scene) : undefined;
  const order: ExtractStage[] = prepare?.hasClip ? ["upload", "reading", "validating", "preparing"] : ["reading", "validating", "preparing"];
  const active = order.indexOf(run.stage);
  const error = unknownDemo ? "This recorded sample is unavailable. Choose another sample or return to upload." : activeRun ? run.error : null;
  const refusal = activeRun ? run.refusal : null;

  if (activeRun && run.coachingOff) {
    return <AppShell backHref="/upload" appearance="studio"><main className="screen extract is-off"><LiveCoachingOff goal={session.prepare?.transcript?.trim() || undefined} backHref="/upload" /></main></AppShell>;
  }
  return (
    <AppShell backHref="/upload" appearance="studio">
      <main className="screen extract">
        <section className="extract-stage panel">
          {published ? (
            <PhotoFrame
              className="extract-photo"
              src={sceneAsset(published.scene, heroStep(published.scene)?.keyframe ?? published.scene.hero.image)}
              alt={`${published.tutorial.title} sample frame`}
              sizes="(max-width: 800px) 100vw, 520px"
              recordedLabel
              priority
              overlay={heroFile ? { samUrl: sceneAsset(published.scene, heroFile), nouns: heroNouns(published.scene) } : null}
            />
          ) : null}
          <div className="ring is-idle">
            <strong className="mono">{(run.elapsed / 1000).toFixed(1)}s</strong>
            <span>this run</span>
          </div>
          <p className="mono">{session.runtime.sparkModelId}</p>
          <div className="chip-row">
            {prepare?.sampleId && !prepare.hasClip ? <Chip>Recorded sample</Chip> : <Chip>{prepare?.hasClip ? "Preparing uploaded clip" : "Preparing transcript"}</Chip>}
          </div>
          <p className="quiet">{prepare?.sampleId && !prepare.hasClip ? "Recorded instructions and saved overlays. This does not test live coaching." : "Waiting for Spark. Execution source is shown after a result returns."}</p>
        </section>
        <section>
          <ol className="capsules">
            {order.map((id, index) => {
              const state = index < active ? "done" : index === active ? "running" : "wait";
              return (
                <li key={id} className={`capsule is-${state}`}>
                  <Chip tone={state === "done" ? "match" : state === "running" ? "running" : "neutral"} pulse={state === "running"}>{state === "running" ? "Running" : state === "done" ? "Done" : "Wait"}</Chip>
                  {extractionStageLabel(id, prepare)}
                </li>
              );
            })}
          </ol>
          <ul className="skeleton" aria-hidden="true">
            <li />
            <li />
            <li />
          </ul>
          {activeRun && run.capped ? (
            <div className="panel error-panel" role="status">
              <h1>Today's model limit is reached</h1>
              <p>Your upload is kept as a draft. Choose a recorded sample with its own instructions, clip and credits, or return to edit your upload.</p>
              <div className="sample-grid">
                {PUBLISHED_SAMPLES.map((sample) => <Link key={sample.id} className="btn btn-secondary" href={`/extracting?demo=${sample.id}`}>{sample.tutorial.title}</Link>)}
              </div>
              <Link className="btn btn-primary" href="/upload">Return to upload</Link>
            </div>
          ) : null}
          {refusal ? (
            <div className="panel error-panel" role="status">
              <h1>Cannot coach this goal</h1>
              <p>{refusal}</p>
              <p>Try a safe household task, like making tea or folding a shirt.</p>
              <Link className="btn btn-primary" href="/upload">Back to upload</Link>
            </div>
          ) : null}
          {error ? (
            <div className="panel error-panel">
              <h1>Could not prepare steps</h1>
              <p>{error}</p>
              {run.attempt > 0 ? <p className="mono">Used one automatic validation retry.</p> : null}
              {activeRun && run.error && prepare ? (
                canRetryExtraction(run)
                  ? <button className="btn btn-primary" type="button" onClick={() => dispatch({ type: "retry", prepare })}>Retry preparation</button>
                  : <p>{MAX_PREPARATION_RETRIES} preparation retries used. Return to upload to edit the input.</p>
              ) : null}
              <Link className="btn btn-primary" href="/upload">Back to upload</Link>
            </div>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}
