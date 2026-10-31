"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { shapeClass } from "@/src/samples/frame-fit";
import { heroSamFile, heroStep, presentNouns, recordedFrameFile, RECORDED_SAM_LABEL, sceneAsset, type SampleScene } from "@/src/samples/scene";
import { SparkMark } from "./mark";
import { PhotoFrame } from "./PhotoFrame";
import { SafetyNote } from "./SafetyNote";
import { SampleCredit, SceneCredit } from "./SampleCredit";

const CHAI = PUBLISHED_SAMPLES.find((sample) => sample.id === "masala-chai") ?? PUBLISHED_SAMPLES[0];
const HERO_STEPS = CHAI.tutorial.steps.map((step) => step.instructionText);

function frameSrc(scene: SampleScene, file: string): string {
  return sceneAsset(scene, file);
}

export function Landing() {
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
          <h1>Follow a tutorial on camera.</h1>
          <p className="lead">Put the phone on a stand. The objects in each step light up as you match the lesson.</p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/upload">Try the coach <ArrowRight size={18} strokeWidth={1.5} /></Link>
            <a className="btn btn-ghost" href="#demos">Watch the demos</a>
          </div>
        </div>
            <HeroStage scene={chai} />
      </header>

      <section className="section wrap" id="how">
        <p className="kicker">How it works</p>
        <h2>Three moves. The clip stays yours.</h2>
        <div className="how-reels">
          <article>
            <span className="index">01</span>
            <h3>Upload a clip you own</h3>
            <div className={`reel-phone ${shapeClass(CHAI.shape)}`}>
              <PhotoFrame
                className="is-fill"
                src={frameSrc(chai, chai.steps[0]?.keyframe ?? chai.hero.image)}
                alt="Kitchen mortar and pestle, first sample frame"
                loopSrc={frameSrc(chai, CHAI.clip)}
                objectPosition={CHAI.stepCrops[0] ?? CHAI.crop}
                zoom={CHAI.stepZooms[0] ?? CHAI.zoom}
                sampleChip
                showProgress
              />
            </div>
          </article>
          <article>
            <span className="index">02</span>
            <h3>Steps from the lesson</h3>
            <div className={`reel-phone ${shapeClass(CHAI.shape)}`}>
              <PhotoFrame
                className="is-fill"
                src={frameSrc(chai, chai.steps[1]?.keyframe ?? chai.hero.image)}
                alt="Hands crushing spices in the same mortar"
                objectPosition={CHAI.stepCrops[1] ?? CHAI.crop}
                zoom={CHAI.stepZooms[1] ?? CHAI.zoom}
              />
            </div>
          </article>
          <article>
            <span className="index">03</span>
            <h3>Highlights on the objects</h3>
            <div className={`reel-phone ${shapeClass(CHAI.shape)}`}>
              <PhotoFrame
                className="is-fill"
                src={frameSrc(chai, chai.steps[0]?.keyframe ?? chai.hero.image)}
                alt="Recorded highlight on the mortar"
                objectPosition={CHAI.stepCrops[0] ?? CHAI.crop}
                zoom={CHAI.stepZooms[0] ?? CHAI.zoom}
                overlay={heroOverlay(chai)}
              />
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
            <PhotoFrame
              src={frameSrc(chai, chai.steps[2]?.keyframe ?? chai.hero.image)}
              alt="Dried herbs over the same kitchen mortar"
              sampleChip
            />
            <p>{HERO_STEPS[1]}</p>
            <SceneCredit scene={chai} />
          </div>
        </article>
      </section>

      <section className="section wrap" id="demos">
        <p className="kicker">Demos</p>
        <h2>Sample tutorials</h2>
        <div className={`demo-grid${PUBLISHED_SAMPLES.length === 1 ? " is-featured" : " is-set"}`}>
          {PUBLISHED_SAMPLES.map((sample) => {
            const tags = presentNouns(heroStep(sample.scene) ?? sample.scene.steps[0]);
            return (
              <article className="panel demo-card" key={sample.id}>
                <div className="reel-phone card-frame">
                  <PhotoFrame
                    className="is-fill"
                    src={frameSrc(sample.scene, sample.cardOutlines ? recordedFrameFile(sample.scene, Math.max(0, (sample.scene.hero.samStep ?? 1) - 1)) : sample.poster)}
                    alt={`${sample.tutorial.title} sample frame`}
                    loopSrc={sample.cardOutlines ? undefined : frameSrc(sample.scene, sample.clip)}
                    objectPosition={sample.cardCrop}
                    zoom={sample.cardZoom}
                    sampleChip
                    showProgress={sample.cardOutlines ? false : true}
                    drawOutlines={sample.cardOutlines}
                    overlay={sample.cardOutlines ? heroOverlay(sample.scene) : null}
                  />
                </div>
                <div className="demo-body">
                  <h3>{sample.tutorial.title.replace(/^Sample · /, "")}</h3>
                  <SafetyNote note={sample.safetyNote} />
                  <p>{sample.tutorial.steps[0]?.successCheck.description}</p>
                  {!sample.cardOutlines && tags.length ? (
                    <ul className="demo-tags">
                      {tags.map((noun) => <li key={noun.noun} style={{ borderColor: noun.color }}>{noun.noun}</li>)}
                    </ul>
                  ) : null}
                  <SceneCredit scene={sample.scene} />
                  <ol className="step-list">
                    {sample.tutorial.steps.map((step) => <li key={step.id}>{step.instructionText}</li>)}
                  </ol>
                  <Link className="btn btn-primary" href={`/extracting?demo=${sample.id}`}>Open in coach</Link>
                </div>
              </article>
            );
          })}
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
            <p>Keyframe highlights for 2 to 4 objects. A 2 second chunk stays optional because Gate 0 measured it past the live threshold.</p>
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

function heroOverlay(scene: SampleScene) {
  const file = heroSamFile(scene);
  const step = heroStep(scene);
  if (!file || !step) return null;
  return {
    samUrl: sceneAsset(scene, file),
    nouns: presentNouns(step).filter((noun) => noun.verified !== false),
  };
}

function HeroStage({ scene }: { scene: SampleScene }) {
  const [index, setIndex] = useState(0);
  const [motion, setMotion] = useState(true);
  const heroStill = scene.hero.image;
  const overlay = heroOverlay(scene);
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
    <div className="hero-media">
      <div className="hero-proof">
        <div className="hero-source">
          <PhotoFrame
            className="is-fill"
            src={frameSrc(scene, heroStill)}
            alt="Full 16:9 source of the sample kitchen clip"
            sizes="(max-width: 800px) 100vw, 520px"
            loopSrc={frameSrc(scene, CHAI.clip)}
            objectPosition={{ x: 0.5, y: 0.5 }}
            zoom={1}
            priority
            overlay={overlay}
          />
        </div>
        <div className={`reel-phone hero-reel ${shapeClass(CHAI.shape)}`}>
          <PhotoFrame
            className="is-fill"
            src={frameSrc(scene, heroStill)}
            alt="Stone mortar and pestle in one kitchen, sample hero frame"
            sizes="(max-width: 800px) 100vw, 360px"
            loopSrc={frameSrc(scene, CHAI.clip)}
            objectPosition={CHAI.crop}
            zoom={CHAI.zoom}
            priority
            status={RECORDED_SAM_LABEL}
            showProgress
            overlay={overlay}
          />
        </div>
      </div>
      <article className="mock-card is-below" key={HERO_STEPS[index]}>
        <p className="mock-kicker">Step {index + 1} of {HERO_STEPS.length} · Match</p>
        <h2>{HERO_STEPS[index]}</h2>
        <SceneCredit scene={scene} />
      </article>
    </div>
  );
}
