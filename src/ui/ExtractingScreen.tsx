"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell, Chip } from "./chrome";
import { useSession, type PrepareRequest, type StepsSource } from "./session";
import type { ToolCall, TutorialSteps } from "@/src/schema/types";
import { postSpark, type ExtractStage } from "./sparkOnce";
import { applyUserAttribution } from "@/src/schema/attribution";
import { validateTutorialSteps } from "@/src/schema/validate";
import { PUBLISHED_SAMPLES, sampleByPublishedId } from "@/src/domains/catalog";
import { heroNouns, heroSamFile, heroStep, sceneAsset } from "@/src/samples/scene";
import { PhotoFrame } from "./PhotoFrame";
import { REFUSAL_UNSAFE } from "@/src/safety/goal-screen";
import { readStepsCache, writeStepsCache } from "./steps-cache";

async function useCapFallback(prepare: PrepareRequest): Promise<{ tutorial: TutorialSteps; toolCalls: ToolCall[]; source: StepsSource } | null> {
  if (!prepare.creatorName || !prepare.licenceChoice) return null;
  const meta = { creatorName: prepare.creatorName, licence: prepare.licenceChoice, creditLink: prepare.creditLink };
  if (prepare.clipHash) {
    const cached = await readStepsCache(prepare.clipHash);
    if (cached) {
      return { tutorial: applyUserAttribution(cached.tutorial, meta), toolCalls: cached.toolCalls, source: "cap_cache" };
    }
  }
  const raw = PUBLISHED_SAMPLES.find((item) => item.id === prepare.sampleId)?.tutorial
    ?? PUBLISHED_SAMPLES.find((item) => item.domain === prepare.domain)?.tutorial
    ?? PUBLISHED_SAMPLES[0].tutorial;
  const validated = validateTutorialSteps(raw);
  if (!validated.ok) return null;
  return { tutorial: applyUserAttribution(validated.value, meta), toolCalls: [], source: "cap_sample" };
}

const STAGE_LABEL: Record<ExtractStage, string> = {
  upload: "Uploading clip",
  reading: "Spark reading video",
  validating: "Validating steps",
  preparing: "Preparing coach",
};

export function ExtractingScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<ExtractStage>("reading");
  const demo = params.get("demo");

  useEffect(() => {
    if (!demo || session.prepare) return;
    const published = sampleByPublishedId(demo);
    const sampleId = published?.id ?? (demo === "aloo-jeera" ? "aloo-jeera" : PUBLISHED_SAMPLES[0].id);
    const prepare: PrepareRequest = {
      key: `demo:${sampleId}`,
      sampleId,
      hasClip: false,
      creatorName: published?.creatorName ?? "Sample cook",
      licenceChoice: "self_filmed",
      domain: published?.domain ?? "indian_recipe",
      title: published?.tutorial.title,
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
    postSpark(request, (next) => {
      if (!cancelled) setStage(next);
    }).then(async (result) => {
      if (cancelled) return;
      setStage("validating");
      if (result.refused) {
        setRefusal(result.refusalReason || REFUSAL_UNSAFE);
        return;
      }
      if (!result.schemaValid || !result.tutorial) {
        if (attempt < 1) {
          setAttempt(1);
          return;
        }
        setError(result.errors[0] || "The steps JSON did not validate.");
        return;
      }
      if (request.clipHash && (result.inputKind === "clip" || result.inputKind === "transcript" || result.inputKind === "sample")) {
        await writeStepsCache(request.clipHash, {
          tutorial: result.tutorial,
          toolCalls: result.toolCalls,
          inputKind: result.inputKind,
        });
      }
      if (cancelled) return;
      setStage("preparing");
      session.setTutorial(result.tutorial, result.latencyMs, result.toolCalls, result.inputKind);
      router.push("/coach");
    }).catch(async (error: Error & { code?: string }) => {
      if (cancelled) return;
      if (error.code === "daily_cap") {
        const saved = await useCapFallback(request);
        if (saved) {
          setStage("preparing");
          session.setTutorial(saved.tutorial, 0, saved.toolCalls, saved.source);
          router.push("/coach");
          return;
        }
      }
      setError(error.message || "Spark did not return steps.");
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, error, router, session, session.prepare]);

  const published = sampleByPublishedId(demo) ?? sampleByPublishedId(session.prepare?.sampleId);
  const heroFile = published ? heroSamFile(published.scene) : undefined;
  const order: ExtractStage[] = session.prepare?.hasClip
    ? ["upload", "reading", "validating", "preparing"]
    : ["reading", "validating", "preparing"];
  const active = order.indexOf(stage);

  return (
    <AppShell backHref="/upload">
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
            <strong className="mono">{(elapsed / 1000).toFixed(1)}s</strong>
            <span>this run</span>
          </div>
          <p className="mono">{session.runtime.sparkModelId}</p>
          <div className="chip-row">
            {session.runtime.mock ? <Chip tone="mock">Mock</Chip> : null}
            {session.prepare?.hasClip && !session.runtime.mock ? <Chip>Steps from clip · muse-spark-1.3</Chip> : <Chip>Steps from transcript (Sample)</Chip>}
            {session.runtime.mock || !session.prepare?.hasClip ? <Chip>Sample</Chip> : null}
          </div>
          <p className="quiet">
            {session.runtime.mock
              ? "Mock client. This is not a live Spark call."
              : "A clip often takes 15 to 20 seconds. This clock is this run."}
          </p>
        </section>
        <section>
          <ol className="capsules">
            {order.map((id, index) => {
              const state = index < active ? "done" : index === active ? "running" : "wait";
              return (
                <li key={id} className={`capsule is-${state}`}>
                  <Chip tone={state === "done" ? "match" : state === "running" ? "running" : "neutral"} pulse={state === "running"}>{state === "running" ? "Running" : state === "done" ? "Done" : "Wait"}</Chip>
                  {STAGE_LABEL[id]}
                </li>
              );
            })}
          </ol>
          <ul className="skeleton" aria-hidden="true">
            <li />
            <li />
            <li />
          </ul>
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
