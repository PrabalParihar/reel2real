"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Clapperboard, ScanLine } from "lucide-react";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { heroNouns, heroSamFile, heroStep, sceneAsset, type SampleScene } from "@/src/samples/scene";
import { Chip } from "./chrome";
import { SparkMark } from "./mark";
import { PhotoFrame } from "./PhotoFrame";
import { SampleCredit } from "./SampleCredit";
import { useSession } from "./session";

const CHAI = PUBLISHED_SAMPLES[0];
const HERO_STEPS = CHAI.tutorial.steps.map((step) => step.instructionText);

function frameSrc(scene: SampleScene, file: string): string {
  return sceneAsset(scene, file);
}

export function Landing() {
  const { runtime } = useSession();
  const chai = CHAI.scene;
  return (
    <div className="landing">
      <div className="nav-wrap">
        <nav className="nav" aria-label="Primary">
          <Link href="/" className="wordmark"><SparkMark /> Reel2Real</Link>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#demos">Demos</a>
            <a href="#meta">Built with Meta</a>
          </div>
          <div className="nav-actions">
            <Link className="btn btn-ghost btn-sm" href="/upload">Open app</Link>
            <Link className="btn btn-primary btn-sm" href="/upload">Try the coach</Link>
          </div>
        </nav>
      </div>

      <header className="hero-bleed mesh section hero">
        <div className="hero-copy">
          <p className="kicker">Phone stand · Upload · Coach</p>
          <h1>Upload a tutorial. Follow it with your camera.</h1>
          <p className="lead">Muse Spark turns your clip into steps. SAM checks 2–4 objects on keyframes from a phone on a stand.</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/upload">Try the coach <ArrowRight size={18} strokeWidth={1.5} /></Link>
            <a className="btn btn-ghost" href="#demos">Watch the demos</a>
          </div>
        </div>
        <HeroStage mock={runtime.mock} scene={chai} />
      </header>

      <section className="section wrap" id="how">
        <p className="kicker">How it works</p>
        <h2>Three moves. The clip stays yours.</h2>
        <div className="bento">
          <article className="panel bento-feature">
            <span className="index">01</span>
            <Camera strokeWidth={1.5} />
            <h3>Upload a clip you own</h3>
            <p>MP4 or WebM you filmed, or a creator clip with written permission. You enter the creator name and the licence. The file stays in this browser.</p>
            <PhotoFrame
              src={frameSrc(chai, chai.steps[0]?.keyframe ?? chai.hero.image)}
              alt="Kitchen mortar and pestle, first sample frame"
              sampleChip
            />
          </article>
          <article className="panel">
            <span className="index">02</span>
            <Clapperboard strokeWidth={1.5} />
            <h3>Spark writes the steps</h3>
            <p>Muse Spark reads the clip once and returns steps JSON. A short clip goes as a 2 second chunk. A longer one uses the files upload.</p>
            <div className="mini-visual">
              <span>{CHAI.tutorial.title.replace(/^Sample · /, "")} · {HERO_STEPS.length} steps</span>
              <ol className="step-list">
                {HERO_STEPS.map((line) => <li key={line}>{line}</li>)}
              </ol>
            </div>
          </article>
          <article className="panel">
            <span className="index">03</span>
            <ScanLine strokeWidth={1.5} />
            <h3>Coach with SAM</h3>
            <p>SAM 3.1 checks 2–4 objects about every 2 seconds on a keyframe. Advance, skip, out of order, one safety rule.</p>
            <PhotoFrame
              src={frameSrc(chai, chai.steps[1]?.keyframe ?? chai.hero.image)}
              alt="Hands crushing spices in the same mortar"
              sampleChip
            />
          </article>
        </div>
      </section>

      <section className="section wrap">
        <article className="panel credit-panel">
          <div>
            <p className="kicker">Credit</p>
            <h2>Creator clip and credit on every step</h2>
            <p>
              Each step shows the matching segment of the tutorial and a credit line. Self-filmed demos are marked Sample.
              A third-party clip needs a written permission letter in /legal before it can appear in a demo video or a submission.
            </p>
          </div>
          <div className="credit-mock">
            <PhotoFrame
              src={frameSrc(chai, chai.steps[2]?.keyframe ?? chai.hero.image)}
              alt="Dried herbs over the same kitchen mortar"
              sampleChip
            />
            <p>{HERO_STEPS[1]}</p>
            <p>Credit · {chai.sourceClip.author} · Pexels License</p>
          </div>
        </article>
      </section>

      <section className="section wrap" id="demos">
        <p className="kicker">Demos</p>
        <h2>Two Sample tutorials</h2>
        <div className="demo-grid">
          {PUBLISHED_SAMPLES.map((sample) => (
            <article className="panel demo-card" key={sample.id}>
              <PhotoFrame
                className="tall"
                src={frameSrc(sample.scene, sample.scene.hero.image)}
                alt={`${sample.tutorial.title} sample frame`}
                sampleChip
              />
              <div className="demo-body">
                <Chip tone="neutral">Sample</Chip>
                <h3>{sample.tutorial.title.replace(/^Sample · /, "")}</h3>
                <p>{sample.tutorial.steps[0]?.successCheck.description}</p>
                <ol className="step-list">
                  {sample.tutorial.steps.map((step) => <li key={step.id}>{step.instructionText}</li>)}
                </ol>
                <Link className={sample.id === PUBLISHED_SAMPLES[0].id ? "btn btn-primary" : "btn btn-ghost"} href={`/extracting?demo=${sample.id}`}>Open in coach</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section wrap" id="meta">
        <p className="kicker">Models</p>
        <h2>Built on Meta Model API</h2>
        <div className="model-grid">
          <article className="panel model-card">
            <h3>Muse Spark</h3>
            <p>Turns a tutorial transcript into steps JSON. Called once, when you extract steps.</p>
            <p className="mono">{SPARK_MODEL_ID}</p>
          </article>
          <article className="panel model-card">
            <h3>SAM 3.1</h3>
            <p>Keyframe highlights for 2–4 objects. A 2 second chunk stays optional because Gate 0 measured it past the live threshold.</p>
            <p className="mono">{SAM_MODEL_ID}</p>
          </article>
        </div>
        <p className="quiet">Muse Image is not used.</p>
      </section>

      <section className="closing mesh">
        <div className="orb" />
        <div className="phone-ghost ghost-back" />
        <h2>Put the phone on a stand. Follow along.</h2>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/upload">Try the coach</Link>
          <a className="btn btn-ghost" href="#demos">View demos</a>
        </div>
      </section>

      <footer className="footer wrap">
        <p>© Reel2Real · Indie · Meta Global AI Hackathon</p>
        <p>Upload only. Self-filmed demos are labelled Sample.</p>
        <SampleCredit />
        <p className="footer-links">
          <a href="#how">How it works</a>
          <a href="#demos">Demos</a>
          <Link href="/upload">App</Link>
        </p>
      </footer>
    </div>
  );
}

function HeroStage({ mock, scene }: { mock: boolean; scene: SampleScene }) {
  const [index, setIndex] = useState(0);
  const [motion, setMotion] = useState(true);
  const samFile = heroSamFile(scene);
  const heroStill = heroStep(scene)?.keyframe ?? scene.hero.image;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!motion) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % HERO_STEPS.length), 2800);
    return () => clearInterval(timer);
  }, [motion]);
  return (
    <div className="hero-stage">
      <PhotoFrame
        className="is-fill"
        src={frameSrc(scene, heroStill)}
        alt="Stone mortar and pestle in one kitchen, sample hero frame"
        sizes="(max-width: 800px) 100vw, 720px"
        priority
        recordedLabel
        overlay={samFile ? { samUrl: sceneAsset(scene, samFile), nouns: heroNouns(scene) } : null}
      />
      <div className="hero-overlay">
        <div className="mock-top">
          <Chip tone="wait">{mock ? "Keyframe stills · Sample steps" : "Keyframe stills · Steps from clip"}</Chip>
          <span className="checking">Checking…</span>
        </div>
        <article className="mock-card" key={HERO_STEPS[index]}>
          <p className="mock-kicker">Step {index + 1} of {HERO_STEPS.length} · Match</p>
          <h2>{HERO_STEPS[index]}</h2>
          <p>Credit · {scene.sourceClip.author} · Pexels License</p>
        </article>
      </div>
    </div>
  );
}
