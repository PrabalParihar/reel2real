"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, ChevronDown, Clapperboard, Grid2X2, Info, ListChecks, ShieldCheck, Upload } from "lucide-react";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { cardCoverStep, heroSamFile, heroStep, presentNouns, recordedFrameFile, sceneAsset, uniqueByNoun, type SampleScene } from "@/src/samples/scene";
import { SparkMark } from "./mark";
import { PhotoFrame } from "./PhotoFrame";
import { SafetyNote } from "./SafetyNote";
import { SampleCoachStill } from "./SampleCoachStill";
import { SampleCredit, SceneCredit } from "./SampleCredit";
import { useSession } from "./session";

const CHAI = PUBLISHED_SAMPLES.find((sample) => sample.id === "masala-chai") ?? PUBLISHED_SAMPLES[0];
const LESSON_FILTERS = [
  { id: "all", label: "All lessons" },
  { id: "kitchen", label: "Kitchen" },
  { id: "make", label: "Make & grow" },
] as const;
type LessonCategory = typeof LESSON_FILTERS[number]["id"];

function lessonCategory(id: string): Exclude<LessonCategory, "all"> {
  return id === "masala-chai" || id === "latte-art" ? "kitchen" : "make";
}

function frameSrc(scene: SampleScene, file: string): string {
  return sceneAsset(scene, file);
}

export function Landing() {
  const { runtime } = useSession();
  const [category, setCategory] = useState<LessonCategory>("all");
  const lessons = PUBLISHED_SAMPLES.filter((sample) => category === "all" || lessonCategory(sample.id) === category);

  return (
    <div className="landing studio-theme">
      <a className="discovery-skip" href="#demos">Skip to lessons</a>

      <aside className="discovery-rail" aria-label="Explore Reel2Real">
        <Link href="/" className="wordmark discovery-brand"><SparkMark /> Reel2Real</Link>
        <p className="discovery-rail-intro">A tutorial on your screen.<br />A next step in your hands.</p>
        <nav className="discovery-rail-nav" aria-label="Explore">
          <p className="discovery-nav-label">Discover</p>
          <a className="discovery-rail-current" href="#demos"><Grid2X2 size={17} /> Recorded lessons <span>{PUBLISHED_SAMPLES.length}</span></a>
          <a href="#how"><ListChecks size={17} /> How it works</a>
          <Link href="/upload"><Upload size={17} /> Use my clip</Link>
          <Link href="/instruct"><Camera size={17} /> Goal + camera</Link>
          <p className="discovery-nav-label discovery-nav-label-next">Behind the coach</p>
          <a href="#meta"><SparkMark /> The models</a>
          <a href="#credits"><ShieldCheck size={17} /> Credit & permission</a>
        </nav>
        <div className="discovery-rail-bottom">
          <div className="discovery-rail-note">
            <Clapperboard size={20} />
            <h2>Start with a sample.</h2>
            <p>Real lesson footage, supplied steps and recorded highlights. No camera needed.</p>
            <a href="#demos">Find your first lesson <ArrowUpRight size={14} /></a>
          </div>
          <p className="discovery-rail-foot">Made for learning by doing.</p>
        </div>
      </aside>

      <main className="discovery-main">
        <div className="discovery-topbar">
          <nav aria-label="Primary">
            <Link href="/" className="wordmark discovery-mobile-brand"><SparkMark /> Reel2Real</Link>
            <a className="discovery-breadcrumb" href="#demos"><Grid2X2 size={15} /> Explore lessons</a>
            <div className="discovery-top-actions">
              <a className="discovery-top-link" href="#how">How it works</a>
              <Link className="btn btn-primary btn-sm" href="/upload">Use my clip <ArrowUpRight size={14} /></Link>
            </div>
          </nav>
        </div>

        <div className="discovery-content">
          <header className="discovery-intro">
            <p className="discovery-eyebrow"><span /> From watching to doing</p>
            <h1>Follow a tutorial on camera.</h1>
            <p className="discovery-lead">Turn a short tutorial into steps, then follow along with your phone on a stand. Object highlights help you frame the workspace.</p>
            <div className="discovery-actions">
              <a className="btn btn-primary" href="#demos">Try a recorded sample <ArrowRight size={16} /></a>
              <Link className="btn btn-ghost" href="/upload">Use my clip</Link>
              <Link className="btn btn-ghost" href="/instruct">Goal + camera</Link>
            </div>
            <p className="discovery-intro-note">Recorded samples need no camera. Your own plan starts with a clip, or a goal and one workspace photo.</p>
            {runtime.capabilities?.spark === false || runtime.capabilities?.instruct === false ? (
              <p className="discovery-availability">Available here: recorded samples.{runtime.capabilities?.spark === false ? " Clip extraction is unavailable." : ""}{runtime.capabilities?.instruct === false ? " Camera planning is unavailable." : ""}</p>
            ) : null}
            {runtime.capabilities?.segment === false ? <p className="discovery-availability">Live object highlights are unavailable in this environment.</p> : null}
          </header>

          <section className="discovery-lessons" id="demos" tabIndex={-1} aria-labelledby="recorded-heading">
            <div className="discovery-section-heading">
              <div>
                <h2 id="recorded-heading">Try a recorded sample</h2>
                <p>Supplied steps and recorded highlights. No camera or live model call needed.</p>
              </div>
              <span className="discovery-small-label"><Clapperboard size={14} /> Ready to explore</span>
            </div>
            <div className="discovery-toolbar">
              <div className="discovery-filters" role="group" aria-label="Filter recorded lessons">
                {LESSON_FILTERS.map((filter) => (
                  <button
                    type="button"
                    key={filter.id}
                    aria-pressed={category === filter.id}
                    aria-controls="recorded-lessons"
                    onClick={() => setCategory(filter.id)}
                  >
                    {filter.label}
                    <span>{PUBLISHED_SAMPLES.filter((sample) => filter.id === "all" || lessonCategory(sample.id) === filter.id).length}</span>
                  </button>
                ))}
              </div>
              <p className="discovery-result-count" role="status">{lessons.length} lessons</p>
            </div>
            <div className="discovery-gallery" id="recorded-lessons">
              {lessons.map((sample) => {
                const cover = cardCoverStep(sample.scene, sample.cardOutlines);
                const title = sample.tutorial.title.replace(/^Sample · /, "");
                const tags = uniqueByNoun(presentNouns(cover).filter((noun) => noun.verified !== false));
                return (
                  <article className="lesson-card" key={sample.id}>
                    <Link className="discovery-card-media" href={`/extracting?demo=${sample.id}`} aria-label={`Open ${title} recorded sample`}>
                      <PhotoFrame
                        className="is-fill"
                        src={frameSrc(sample.scene, sample.cardOutlines ? recordedFrameFile(sample.scene, cover.index) : sample.poster)}
                        alt={`${sample.tutorial.title} sample frame`}
                        loopSrc={sample.cardOutlines ? undefined : frameSrc(sample.scene, sample.clip)}
                        objectPosition={sample.cardCrop}
                        zoom={sample.cardZoom}
                        sampleChip
                        recordedLabel={sample.cardOutlines}
                        showProgress={false}
                        durationSec={sample.cardOutlines ? undefined : sample.loopDurationSec}
                        drawOutlines={sample.cardOutlines}
                        overlay={sample.cardOutlines ? heroOverlay(sample.scene) : null}
                      />
                    </Link>
                    <div className="discovery-card-body">
                      <p className="discovery-card-category">{lessonCategory(sample.id) === "kitchen" ? "Kitchen" : "Make & grow"}<span>{sample.tutorial.steps.length} steps</span></p>
                      <h3>{title}</h3>
                      <SafetyNote note={sample.safetyNote} />
                      <p className="discovery-card-description">{sample.tutorial.steps[cover.index]?.successCheck.description}</p>
                      {!sample.cardOutlines && tags.length ? (
                        <ul className="discovery-object-tags">
                          {tags.map((noun) => <li key={noun.objectId} style={{ borderColor: noun.color }}>{noun.noun}</li>)}
                        </ul>
                      ) : null}
                      <details className="discovery-card-steps">
                        <summary>See the lesson steps <ChevronDown size={14} /></summary>
                        <ol>
                          {sample.tutorial.steps.map((step) => <li key={step.id}>{step.instructionText}</li>)}
                        </ol>
                      </details>
                      <div className="discovery-card-bottom">
                        <SceneCredit scene={sample.scene} />
                        <Link className="btn btn-ghost" href={`/extracting?demo=${sample.id}`} aria-label={`Open ${title} in coach`}>Open in coach <ArrowUpRight size={16} /></Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="discovery-support" id="how" aria-labelledby="how-heading">
            <div className="discovery-section-heading">
              <div><p className="discovery-eyebrow">A little structure. More doing.</p><h2 id="how-heading">From your clip to the next action.</h2></div>
            </div>
            <div className="discovery-how-grid">
              <article><span className="discovery-step-number">01 <Upload size={17} /></span><h3>Bring a tutorial</h3><p>Upload a short clip you filmed or have permission to use. Keep the creator credit with it.</p></article>
              <article><span className="discovery-step-number">02 <ListChecks size={17} /></span><h3>Get the steps</h3><p>Turn the lesson into a plan with one clear action at a time and the objects each step needs.</p></article>
              <article><span className="discovery-step-number">03 <Camera size={17} /></span><h3>Follow along</h3><p>Put your phone on a stand. Keep your workspace in view and move through the steps at your pace.</p></article>
            </div>
            <p className="discovery-data-note"><Info size={16} /><span>Your complete clip and task details are sent to the configured AI service when you extract a plan. Camera planning sends a captured workspace photo and your goal. Live object checks send workspace images. <strong>Object presence does not verify technique or safety.</strong></span></p>
          </section>

          <section className="discovery-goal" id="instruct" aria-labelledby="goal-heading">
            <div className="discovery-goal-copy">
              <span className="discovery-feature-icon"><Camera size={21} /></span>
              <p className="discovery-eyebrow">No tutorial? Start here.</p>
              <h2 id="goal-heading">A goal. A workspace.<br />Your next steps.</h2>
              <p>Describe a task and capture one workspace photo to create a plan. This route needs a phone or laptop camera.</p>
              <Link className="btn btn-primary" href="/instruct">Start with a goal <ArrowRight size={16} /></Link>
            </div>
            <div className="discovery-goal-still"><SampleCoachStill /><SceneCredit scene={CHAI.scene} /></div>
          </section>

          <section className="discovery-support" id="meta" aria-labelledby="models-heading">
            <div className="discovery-section-heading"><div><p className="discovery-eyebrow">The models behind the steps</p><h2 id="models-heading">Built on Meta Model API</h2></div></div>
            <div className="discovery-model-grid">
              <article><span className="discovery-model-mark"><SparkMark /></span><div><h3>Muse Spark</h3><p>Creates a step-by-step plan from a supported tutorial clip or a goal with a workspace photo when configured.</p><p className="mono">{SPARK_MODEL_ID}</p></div></article>
              <article><span className="discovery-model-mark"><Grid2X2 size={21} /></span><div><h3>SAM 3.1</h3><p>Draws a box highlight around the 2 to 4 objects each step needs when live object checks are configured.</p><p className="mono">{SAM_MODEL_ID}</p></div></article>
            </div>
            <p className="discovery-model-note">Muse Image is not used. Recorded lessons use supplied steps and saved highlights.</p>
          </section>

          <section className="discovery-rights" id="credits" aria-labelledby="rights-heading">
            <ShieldCheck size={24} />
            <div><h2 id="rights-heading">Creator clip and credit on every step</h2><p>Recorded samples include their supplied media and creator credit. For your own clip, enter the creator and confirm that you filmed it or have permission to use it.</p></div>
            <Link href="/upload">Bring your own clip <ArrowUpRight size={15} /></Link>
          </section>

          <footer className="discovery-footer">
            <div className="discovery-footer-top"><Link href="/" className="wordmark"><SparkMark /> Reel2Real</Link><p>© Reel2Real · Indie · Meta AI Developer Hackathon</p></div>
            <p>Recorded examples are labelled Sample. Upload clips you filmed or have permission to use.</p>
            <SampleCredit />
            <nav aria-label="Footer"><a href="#demos">Recorded lessons</a><a href="#how">How it works</a><Link href="/instruct">Goal + camera</Link><Link href="/upload">Use my clip</Link></nav>
          </footer>
        </div>
      </main>
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
