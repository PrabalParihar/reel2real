"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import type { LicenceChoice } from "@/src/schema/attribution";
import { applyUserAttribution } from "@/src/schema/attribution";
import { AppShell } from "./chrome";
import { sceneAsset } from "@/src/samples/scene";
import { PhotoFrame } from "./PhotoFrame";
import { useSession } from "./session";
import { readStepsCache, sha256Hex } from "./steps-cache";

export function UploadScreen() {
  const router = useRouter();
  const session = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [licence, setLicence] = useState<LicenceChoice | "">("");
  const [creditLink, setCreditLink] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [domain, setDomain] = useState<"indian_recipe" | "non_cooking_diy" | "other">("indian_recipe");
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function takeFile(next: File | null) {
    if (!next) return;
    if (!["video/mp4", "video/webm"].includes(next.type) && !/\.(mp4|webm)$/i.test(next.name)) {
      setNote("Use an MP4 or WebM file.");
      return;
    }
    setNote(null);
    setFile(next);
    setSampleId(null);
  }

  async function extract() {
    if (!licence) {
      setNote("Choose a licence before extracting steps.");
      return;
    }
    if (!creatorName.trim()) {
      setNote("Enter the creator name.");
      return;
    }
    if (!file && !sampleId) return;
    const sample = PUBLISHED_SAMPLES.find((item) => item.id === sampleId);
    let durationSec: number | undefined;
    let url: string | null = null;
    let videoBase64: string | undefined;
    let clipHash: string | undefined;
    if (file) {
      url = URL.createObjectURL(file);
      durationSec = await readDuration(url);
      const bytes = new Uint8Array(await file.arrayBuffer());
      clipHash = await sha256Hex(bytes);
      const cached = await readStepsCache(clipHash).catch(() => null);
      if (cached) {
        const tutorial = applyUserAttribution(cached.tutorial, { creatorName, licence, creditLink });
        session.setPrepare({
          key: `cache:${clipHash}`,
          hasClip: true,
          clipHash,
          filename: file.name,
          mimeType: file.type || "video/mp4",
          durationSec,
          creatorName,
          licenceChoice: licence,
          creditLink: creditLink.trim() || undefined,
          title: title.trim() || undefined,
          domain,
          transcript: transcript.trim() || undefined,
        }, url);
        session.setTutorial(tutorial, 0, cached.toolCalls, "cache");
        router.push("/coach");
        return;
      }
      videoBase64 = bytesToBase64(bytes);
    }
    session.setPrepare({
      key: file ? `file:${clipHash}:${licence}` : `demo:${sampleId}:${creatorName}:${licence}`,
      sampleId: sampleId ?? undefined,
      transcript: transcript.trim() || undefined,
      title: title.trim() || sample?.tutorial.title,
      domain: sample?.domain ?? domain,
      filename: file?.name,
      durationSec,
      videoBase64,
      mimeType: file ? file.type || "video/mp4" : undefined,
      creatorName,
      licenceChoice: licence,
      creditLink: creditLink.trim() || undefined,
      clipHash,
      hasClip: Boolean(file),
    }, url);
    router.push("/extracting");
  }

  const ready = Boolean((file || sampleId) && licence && creatorName.trim());

  return (
    <AppShell backHref="/">
      <main className="screen upload-screen">
        <h1>Upload a tutorial</h1>
        <p className="lead">A clip you filmed, or one you have permission to use.</p>
        <div className="upload-grid">
          <section>
            <label
              className={`drop${over ? " is-over" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                takeFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <Upload strokeWidth={1.5} />
              <span>{file ? file.name : "Choose MP4 / WebM"}</span>
              <small>The file stays in this browser. Spark receives a short chunk, or a file upload when the clip is longer.</small>
              <input
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {note ? <p className="form-note">{note}</p> : null}
            <label className="field-label">
              Creator name
              <input className="field" value={creatorName} onChange={(event) => setCreatorName(event.target.value)} />
            </label>
            <fieldset className="licence-set">
              <legend>Licence</legend>
              <button type="button" className={licence === "self_filmed" ? "chip tone-saffron" : "chip tone-neutral"} onClick={() => setLicence("self_filmed")}>Self-filmed</button>
              <button type="button" className={licence === "permission_granted" ? "chip tone-saffron" : "chip tone-neutral"} onClick={() => setLicence("permission_granted")}>Permission granted</button>
            </fieldset>
            <label className="field-label">
              Credit link
              <input className="field" value={creditLink} placeholder="Optional" onChange={(event) => setCreditLink(event.target.value)} />
            </label>
            <label className="field-label">
              Title
              <input className="field" value={title} placeholder="Optional" onChange={(event) => setTitle(event.target.value)} />
            </label>
            <div className="domain-row" role="radiogroup" aria-label="Domain">
              {([
                ["indian_recipe", "Recipe"],
                ["non_cooking_diy", "DIY"],
                ["other", "Other"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" className={domain === value ? "chip tone-saffron" : "chip tone-neutral"} onClick={() => setDomain(value)}>{label}</button>
              ))}
            </div>
            <label className="field-label">
              Transcript fallback
              <textarea className="field" rows={3} value={transcript} placeholder="Used only if no clip is sent." onChange={(event) => setTranscript(event.target.value)} />
            </label>
            <div className="sample-grid">
              {PUBLISHED_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className={sampleId === sample.id ? "sample-card is-on" : "sample-card"}
                  onClick={() => {
                    setSampleId(sample.id);
                    setFile(null);
                    setLicence("self_filmed");
                    setCreatorName(sample.creatorName);
                    setDomain(sample.domain);
                  }}
                >
                  <PhotoFrame
                    src={sceneAsset(sample.scene, sample.scene.hero.image)}
                    alt={`${sample.tutorial.title} sample frame`}
                    sizes="180px"
                    sampleChip
                  />
                  <span>{sample.tutorial.title}</span>
                </button>
              ))}
            </div>
            <div className="upload-dock">
              <button className="btn btn-primary btn-block" type="button" disabled={!ready} onClick={() => void extract()}>
                Extract steps
              </button>
            </div>
          </section>
          <aside className="panel tips">
            <h2>Framing</h2>
            <div className="frame-examples">
              {PUBLISHED_SAMPLES.map((sample) => (
                <PhotoFrame
                  key={sample.id}
                  src={sceneAsset(sample.scene, sample.scene.steps[0]?.keyframe ?? sample.scene.hero.image)}
                  alt={`${sample.tutorial.title} framing still`}
                  sizes="220px"
                />
              ))}
            </div>
            <p>2 to 4 objects work best. Good light. Each tracked object stays fully inside the frame.</p>
            <p>If an object is not highlighted, move it fully into the frame before you continue.</p>
            <p className="mono">Credit and licence come from this form. Spark does not choose them.</p>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}

function readDuration(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? video.duration : undefined);
    video.onerror = () => resolve(undefined);
    video.src = url;
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}
