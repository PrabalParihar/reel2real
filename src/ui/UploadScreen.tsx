"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import type { LicenceChoice } from "@/src/schema/attribution";
import { screenSparkInput } from "@/src/safety/goal-screen";
import { AppShell } from "./chrome";
import { InstagramShow } from "./InstagramShow";
import { sceneAsset } from "@/src/samples/scene";
import { PhotoFrame } from "./PhotoFrame";
import { useSession, type PrepareRequest } from "./session";
import { prepareClip, validateClipSelection } from "./clip-preparation";
import { clearStepsCache } from "./steps-cache";

type Domain = "indian_recipe" | "non_cooking_diy" | "other";

export function UploadScreen() {
  const router = useRouter();
  const session = useSession();
  const initial = session.prepare?.hasClip ? session.prepare : null;
  const [savedClip, setSavedClip] = useState<PrepareRequest | null>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [creatorName, setCreatorName] = useState(initial?.creatorName ?? "");
  const [licence, setLicence] = useState<LicenceChoice | "">(initial?.licenceChoice ?? "");
  const [creditLink, setCreditLink] = useState(initial?.creditLink ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [transcript, setTranscript] = useState(initial?.transcript ?? "");
  const [domain, setDomain] = useState<Domain>(initial?.domain ?? "indian_recipe");
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fileInvalid, setFileInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cacheNote, setCacheNote] = useState<string | null>(null);
  const preparing = useRef<AbortController | null>(null);
  const unavailable = session.runtime.capabilities?.spark !== true;
  const hasClip = Boolean(file || savedClip?.videoBase64);
  const ready = hasClip && Boolean(licence && creatorName.trim()) && !unavailable;

  useEffect(() => () => { preparing.current?.abort(); preparing.current = null; }, []);
  useEffect(() => { if (unavailable) preparing.current?.abort(); }, [unavailable]);

  function takeFile(next: File | null) {
    if (!next || preparing.current || unavailable) return;
    const invalid = validateClipSelection(next);
    setNote(invalid);
    setFileInvalid(Boolean(invalid));
    if (invalid) { setFile(null); setSavedClip(null); return; }
    setFile(next);
    setSavedClip(null);
  }

  function restoreDraft() {
    const draft = session.uploadDraft;
    if (!draft || !session.restoreUploadDraft()) return;
    const value = draft.prepare;
    setFile(null);
    setSavedClip(value);
    setCreatorName(value.creatorName ?? "");
    setLicence(value.licenceChoice ?? "");
    setCreditLink(value.creditLink ?? "");
    setTitle(value.title ?? "");
    setTranscript(value.transcript ?? "");
    setDomain(value.domain ?? "indian_recipe");
    setNote("Your previous clip and details are restored.");
    setFileInvalid(false);
  }

  async function extract() {
    if (preparing.current) return;
    if (unavailable) { setNote("Clip extraction is unavailable here. Choose a recorded sample above."); return; }
    if (!ready || !licence) { setNote("Choose a clip, enter its creator, and select your permission to use it."); return; }
    const screened = screenSparkInput({ transcript, title });
    if (screened) { setNote(screened.reason); return; }
    const controller = new AbortController();
    preparing.current = controller;
    setBusy(true);
    setNote(null);
    setFileInvalid(false);
    let newUrl: string | null = null;
    try {
      const media = file ? await prepareClip(file, { signal: controller.signal }) : savedClip!;
      if (controller.signal.aborted || preparing.current !== controller) return;
      const metadata = { creatorName: creatorName.trim(), licenceChoice: licence, creditLink: creditLink.trim() || undefined, title: title.trim() || undefined, domain, transcript: transcript.trim() || undefined };
      const prepare: PrepareRequest = {
        ...metadata,
        key: `file:${media.clipHash}:${JSON.stringify(metadata)}`,
        filename: file?.name ?? savedClip?.filename,
        durationSec: media.durationSec,
        videoBase64: media.videoBase64,
        mimeType: media.mimeType,
        clipHash: media.clipHash,
        hasClip: true,
      };
      if (file) newUrl = URL.createObjectURL(file);
      session.setPrepare(prepare, newUrl ?? session.videoUrl);
      newUrl = null; // The session owns and releases this URL after publication.
      router.push("/extracting");
    } catch (cause) {
      if (!controller.signal.aborted && preparing.current === controller) {
        setFileInvalid(true);
        setNote(cause instanceof Error ? cause.message : "Could not prepare this clip. Try again or choose a recorded sample.");
      }
    } finally {
      if (newUrl) URL.revokeObjectURL(newUrl);
      if (preparing.current === controller) { preparing.current = null; setBusy(false); }
    }
  }

  const missing = unavailable ? "Clip extraction is unavailable here. Recorded samples are ready above."
    : !hasClip ? "Choose a clip to continue."
      : !creatorName.trim() ? "Enter the clip creator’s name to continue."
        : !licence ? "Choose how you have permission to use this clip."
          : "Ready to prepare your clip. Nothing is sent until you continue.";

  return (
    <AppShell backHref="/" appearance="studio">
      <main className="screen upload-screen">
        <h1>Choose your tutorial</h1>
        <p className="lead">Try a recorded sample, or use a short clip you filmed or have permission to use.</p>
        {unavailable ? <p className="capability-note" role="status">{session.runtimeStatus === "loading" ? "Checking clip extraction availability. Recorded samples are ready now." : "Clip extraction is unavailable in this environment. Recorded samples work without a camera."}</p> : null}
        {session.runtime.capabilities?.segment === false && !unavailable ? <p className="capability-note">Live object highlights are unavailable here. You can still read the plan and move through it yourself.</p> : null}
        <div className="upload-grid">
          <section>
            <section aria-labelledby="upload-samples-heading" className="upload-samples">
              <h2 id="upload-samples-heading">Try a recorded sample</h2>
              <p className="quiet">Open immediately with supplied steps, media, and creator credit. No upload or camera needed.</p>
              <div className="sample-grid">
                {PUBLISHED_SAMPLES.map((sample) => (
                  <Link key={sample.id} className="sample-card" href={`/extracting?demo=${sample.id}`}>
                    <PhotoFrame src={sceneAsset(sample.scene, sample.scene.hero.image)} alt={`${sample.tutorial.title} sample frame`} sizes="180px" sampleChip />
                    <span>{sample.tutorial.title}</span>
                  </Link>
                ))}
              </div>
            </section>
            {session.uploadDraft ? <button className="btn btn-ghost" type="button" disabled={busy} onClick={restoreDraft}>Restore my previous clip</button> : null}
            <details className="upload-form-details" open={!unavailable}>
              <summary>Use my tutorial clip</summary>
              <p id="clip-limits" className="quiet">MP4 or WebM, up to 16 MB and 2 minutes. This browser must be able to play the video.</p>
              <p id="clip-privacy" className="quiet">Preparation checks the clip in your browser. Continuing sends the complete clip and these details to the configured AI service to create a plan. Live coaching also sends workspace images for object highlights.</p>
              <p className="quiet">Use good light and keep the objects fully in frame. Highlights show object presence; they do not verify technique or safety.</p>
              <fieldset className="upload-inputs" disabled={busy || unavailable}>
                <label className={`drop${over ? " is-over" : ""}`} onDragOver={(event) => { event.preventDefault(); if (!busy) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); setOver(false); takeFile(event.dataTransfer.files?.[0] ?? null); }}>
                  <Upload strokeWidth={1.5} />
                  <span>{file?.name ?? savedClip?.filename ?? "Choose MP4 / WebM (required)"}</span>
                  <small>16 MB maximum · 2 minutes maximum</small>
                  <input id="tutorial-file" type="file" accept="video/mp4,video/webm,.mp4,.webm" aria-describedby="clip-limits clip-privacy upload-status" aria-invalid={fileInvalid} onChange={(event) => takeFile(event.target.files?.[0] ?? null)} />
                </label>
                <label className="field-label" htmlFor="creator-name">Creator name (required)<input id="creator-name" className="field" required maxLength={160} value={creatorName} aria-describedby="upload-status" onChange={(event) => setCreatorName(event.target.value)} /></label>
                <fieldset className="licence-set">
                  <legend>Permission to use this clip (required)</legend>
                  {([["self_filmed", "I filmed it"], ["permission_granted", "I have permission"]] as const).map(([value, label]) => (
                    <label key={value} className={licence === value ? "chip tone-saffron choice-chip" : "chip tone-neutral choice-chip"}>
                      <input type="radio" name="licence" value={value} checked={licence === value} required onChange={() => setLicence(value)} />{label}
                    </label>
                  ))}
                </fieldset>
                <details className="optional-details">
                  <summary>Add optional details</summary>
                  <label className="field-label">Credit link<input className="field" value={creditLink} maxLength={2048} placeholder="Optional" onChange={(event) => setCreditLink(event.target.value)} /></label>
                  <label className="field-label">Title<input className="field" value={title} maxLength={240} placeholder="Optional" onChange={(event) => setTitle(event.target.value)} /></label>
                  <fieldset className="licence-set"><legend>Task type (optional)</legend>
                    {([["indian_recipe", "Recipe"], ["non_cooking_diy", "DIY"], ["other", "Other"]] as const).map(([value, label]) => (
                      <label key={value} className={domain === value ? "chip tone-saffron choice-chip" : "chip tone-neutral choice-chip"}><input type="radio" name="domain" value={value} checked={domain === value} onChange={() => setDomain(value)} />{label}</label>
                    ))}
                  </fieldset>
                  <label className="field-label">Transcript or context (optional)<textarea className="field" rows={3} maxLength={16000} value={transcript} placeholder="Extra context sent with your clip." onChange={(event) => setTranscript(event.target.value)} /></label>
                </details>
              </fieldset>
              <div id="upload-status" className={`form-note${note ? " is-error" : ""}`} role={note ? "alert" : "status"} aria-live="polite">{busy ? "Checking and preparing your clip… This may take up to 15 seconds." : note ?? missing}</div>
              <div className="upload-dock" aria-busy={busy}>
                <button className="btn btn-primary btn-block" type="button" disabled={!ready || busy} onClick={() => void extract()}>{busy ? "Preparing clip…" : "Extract steps"}</button>
                {busy ? <button className="btn btn-ghost" type="button" onClick={() => { preparing.current?.abort(); setNote("Preparation cancelled. Your clip and details are still here."); }}>Cancel preparation</button> : null}
              </div>
              <details className="optional-details"><summary>Optional Instagram reference</summary><p className="quiet">Preview a public post for reference. This does not extract the link; upload a permitted video file separately.</p><InstagramShow /></details>
              <details className="optional-details"><summary>Saved lessons on this device</summary><p className="quiet">Successful clip plans may be cached in this browser so you can reuse them. Clearing saved lessons removes those plans from this device.</p><button className="btn btn-ghost btn-sm" type="button" onClick={() => void clearStepsCache().then((cleared) => setCacheNote(cleared ? "Saved lessons cleared from this browser." : "Saved lesson storage is unavailable. No lessons were cleared."))}>Clear saved lessons</button>{cacheNote ? <p className="form-note" role="status">{cacheNote}</p> : null}</details>
            </details>
          </section>
          <aside className="panel tips">
            <h2>Before you follow along</h2>
            <p>Put your phone on a stand. Keep the objects for the current action fully inside the camera frame.</p>
            <p>Read the full instruction and any supervision notes before starting. You control when to move to the next step.</p>
            <Link className="btn btn-ghost" href="/instruct">Start from a goal + camera</Link>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
