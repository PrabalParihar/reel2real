"use client";

import Link from "next/link";
import { ArrowRight, Camera, Clapperboard, ScanLine } from "lucide-react";
import { GATE0_REPORT, SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { Chip } from "./chrome";
import { SparkMark } from "./mark";
import { useSession } from "./session";

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
            Skip, out-of-order, and one safety rule are part of the coach. Glasses are optional. The phone sits on a stand.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/upload">Try the coach <ArrowRight size={18} strokeWidth={1.5} /></Link>
            <a className="btn btn-ghost" href="#demos">Watch the demos</a>
          </div>
          <p className="mono honesty">
            Sample visuals · Keyframe mode labelled · Meta Model API
            {runtime.mock ? " · Mock client" : ""}
          </p>
        </div>
        <div className="hero-stage" aria-hidden="true">
          <div className="dot-grid" />
          <div className="phone-ghost" />
          <div className="coach-mock">
            <div className="mock-top">
              <Chip tone="wait">Keyframe mode</Chip>
              <Chip tone="neutral">Sample</Chip>
              {runtime.mock ? <Chip tone="mock">Mock</Chip> : null}
            </div>
            <div className="mock-view">
              <span className="blob blob-a"><i />ginger</span>
              <span className="blob blob-b"><i />pestle</span>
              <span className="checking">Checking…</span>
            </div>
            <article className="mock-card">
              <p className="mock-kicker">Step 2 · Match</p>
              <h2>Crush ginger & cardamom</h2>
              <p className="mono">Sample · self-filmed</p>
            </article>
          </div>
        </div>
      </header>

      <section className="section wrap" id="how">
        <p className="kicker">How it works</p>
        <h2>Three moves. The clip stays yours.</h2>
        <div className="bento">
          <article className="panel bento-feature">
            <span className="index">01</span>
            <Camera strokeWidth={1.5} />
            <h3>Upload a clip you own</h3>
            <p>MP4 or WebM you filmed, or a creator clip with a written permission letter. The file stays in this browser.</p>
            <div className="mini-dock">
              <span>Choose MP4 / WebM</span>
              <em>No link field</em>
            </div>
          </article>
          <article className="panel">
            <span className="index">02</span>
            <Clapperboard strokeWidth={1.5} />
            <h3>Spark writes the steps</h3>
            <p>Muse Spark returns steps JSON once, at upload. Completion checks stay visually decidable.</p>
          </article>
          <article className="panel">
            <span className="index">03</span>
            <ScanLine strokeWidth={1.5} />
            <h3>Coach with SAM</h3>
            <p>SAM 3.1 masks 2–4 objects every 1–2 seconds on a keyframe. Advance, skip, out of order, one safety rule.</p>
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
            <div className="filmstrip" />
            <p>Crush ginger & cardamom</p>
            <p className="mono">Credit · Sample · self-filmed</p>
          </div>
        </article>
      </section>

      <section className="section wrap" id="demos">
        <p className="kicker">Demos</p>
        <h2>Two Sample tutorials</h2>
        <div className="demo-grid">
          <article className="panel demo-card">
            <div className="filmstrip tall" />
            <div className="demo-body">
              <Chip tone="neutral">Sample</Chip>
              <h3>Masala chai</h3>
              <p>Indian recipe · mortar, pestle, ginger, cup. Keep every object fully in frame.</p>
              <ul className="step-pills">
                <li>Mortar in frame</li>
                <li>Crush ginger</li>
                <li>Cup beside it</li>
              </ul>
              <Link className="btn btn-primary" href="/extracting?demo=masala-chai">Open in coach</Link>
            </div>
          </article>
          <article className="panel demo-card">
            <div className="filmstrip tall alt" />
            <div className="demo-body">
              <Chip tone="neutral">Sample</Chip>
              <h3>Bike chain wipe</h3>
              <p>Non-cooking DIY · wheel, chain, rag, oil. A thinner second path.</p>
              <ul className="step-pills">
                <li>Layout the wheel</li>
                <li>Wipe the chain</li>
                <li>Oil one link</li>
              </ul>
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
