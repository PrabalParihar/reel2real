"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Clapperboard, ScanLine } from "lucide-react";
import chaiSteps from "@/src/fixtures/sample-masala-chai.steps.json";
import bikeSteps from "@/src/fixtures/sample-bike-chain.steps.json";
import { GATE0_REPORT, SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { Chip } from "./chrome";
import { SparkMark } from "./mark";
import { StillFrame } from "./StandScene";
import { useSession } from "./session";

const CHAI = chaiSteps.steps.map((step) => step.instructionText);
const BIKE = bikeSteps.steps.map((step) => step.instructionText);

export function Landing() {
  const { runtime } = useSession();
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
          <p className="lead">
            Muse Spark turns your clip into checkable steps. SAM 3.1 watches 2–4 objects on keyframes.
            Skip, out of order, and one safety rule are part of the coach. Glasses are optional. The phone sits on a stand.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/upload">Try the coach <ArrowRight size={18} strokeWidth={1.5} /></Link>
            <a className="btn btn-ghost" href="#demos">Watch the demos</a>
          </div>
          <p className="mono honesty">
            {runtime.mock ? "Steps from transcript (Sample) · Mock · " : "Steps from clip · muse-spark-1.3 · "}
            Keyframe mode · Meta Model API
          </p>
        </div>
        <HeroStage mock={runtime.mock} />
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
            <StillFrame kind="chai" />
          </article>
          <article className="panel">
            <span className="index">02</span>
            <Clapperboard strokeWidth={1.5} />
            <h3>Spark writes the steps</h3>
            <p>Muse Spark reads the clip once and returns steps JSON. A short clip goes as a 2 second chunk. A longer one uses the files upload.</p>
            <div className="mini-visual">
              <span>Masala chai · 3 steps</span>
              <ol className="step-list">
                {CHAI.map((line) => <li key={line}>{line}</li>)}
              </ol>
            </div>
          </article>
          <article className="panel">
            <span className="index">03</span>
            <ScanLine strokeWidth={1.5} />
            <h3>Coach with SAM</h3>
            <p>SAM 3.1 checks 2–4 objects every 1–2 seconds on a keyframe. Advance, skip, out of order, one safety rule.</p>
            <div className="mini-visual">
              <span>Keyframe mode</span>
              <span className="blob-row">ginger · pestle · cup</span>
            </div>
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
            <StillFrame kind="chai" />
            <p>{CHAI[1]}</p>
            <p className="mono">Credit · Sample cook (self-filmed) · self-filmed</p>
          </div>
        </article>
      </section>

      <section className="section wrap" id="demos">
        <p className="kicker">Demos</p>
        <h2>Two Sample tutorials</h2>
        <div className="demo-grid">
          <article className="panel demo-card">
            <StillFrame kind="chai" tall />
            <div className="demo-body">
              <Chip tone="neutral">Sample</Chip>
              <h3>Masala chai</h3>
              <p>Indian recipe. Keep the mortar, ginger, and cup fully in frame.</p>
              <ol className="step-list">
                {CHAI.map((line) => <li key={line}>{line}</li>)}
              </ol>
              <Link className="btn btn-primary" href="/extracting?demo=masala-chai">Open in coach</Link>
            </div>
          </article>
          <article className="panel demo-card">
            <StillFrame kind="bike" tall />
            <div className="demo-body">
              <Chip tone="neutral">Sample</Chip>
              <h3>Bike chain wipe</h3>
              <p>Non-cooking DIY. Wheel, chain, and rag stay inside the frame.</p>
              <ol className="step-list">
                {BIKE.map((line) => <li key={line}>{line}</li>)}
              </ol>
              <Link className="btn btn-ghost" href="/extracting?demo=bike-chain">Open in coach</Link>
            </div>
          </article>
        </div>
        <p className="mono footnote">Demo clips are Sample unless a permission letter exists. Placeholder art only. No creator footage is in this repo.</p>
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
            <p>Keyframe masks for 2–4 objects. A 2 second chunk stays optional because Gate 0 measured it past the live threshold.</p>
            <p className="mono">{SAM_MODEL_ID}</p>
          </article>
        </div>
        <p className="note">Muse Image is not used. It is blocked in India under the Geographic Use Policy.</p>
        <p className="mono footnote">
          Gate 0 median time to first mask: {GATE0_REPORT.stillMedianMs} ms on a still, {GATE0_REPORT.chunkMedianMs} ms on a 2s chunk.
          Verdict: {GATE0_REPORT.decision}, keyframe stills. Models actually called are listed in the app and the README.
        </p>
      </section>

      <section className="closing mesh">
        <div className="orb" />
        <div className="phone-ghost ghost-back" />
        <h2>Put the phone on a stand. Cook along.</h2>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/upload">Try the coach</Link>
          <a className="btn btn-ghost" href="#demos">View demos</a>
        </div>
      </section>

      <footer className="footer wrap">
        <p>© Reel2Real · Indie · Meta Global AI Hackathon</p>
        <p className="mono">Upload only · {SPARK_MODEL_ID} · {SAM_MODEL_ID} · Sample labels</p>
        <p className="footer-links">
          <a href="#how">How it works</a>
          <a href="#demos">Demos</a>
          <Link href="/upload">App</Link>
        </p>
      </footer>
    </div>
  );
}

function HeroStage({ mock }: { mock: boolean }) {
  const [index, setIndex] = useState(0);
  const [motion, setMotion] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!motion) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % CHAI.length), 2800);
    return () => clearInterval(timer);
  }, [motion]);
  return (
    <div className="hero-stage" aria-hidden="true">
      <div className="dot-grid" />
      <div className="phone-ghost" />
      <div className="coach-mock">
        <div className="mock-top">
          <Chip tone="wait">Keyframe mode</Chip>
          {mock ? <Chip tone="mock">Mock</Chip> : <Chip>Steps from clip · muse-spark-1.3</Chip>}
          <Chip>Sample</Chip>
        </div>
        <div className={motion ? "mock-view is-loop" : "mock-view"} key={motion ? index : "still"}>
          <span className="blob blob-a"><i />ginger</span>
          <span className="blob blob-b"><i />pestle</span>
          <span className="checking">Checking…</span>
        </div>
        <article className="mock-card" key={CHAI[index]}>
          <p className="mock-kicker">Step {index + 1} of {CHAI.length} · Match</p>
          <h2>{CHAI[index]}</h2>
          <p className="mono">Sample · self-filmed</p>
        </article>
      </div>
    </div>
  );
}
