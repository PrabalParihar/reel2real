"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { AppShell, Chip } from "./chrome";
import { useSession } from "./session";

const SAMPLES = [
  { id: "masala-chai", title: "Sample · Masala chai", domain: "indian_recipe" as const },
  { id: "bike-chain", title: "Sample · Bike chain wipe", domain: "non_cooking_diy" as const },
];

export function UploadScreen() {
  const router = useRouter();
  const session = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [credit, setCredit] = useState("Sample · self-filmed");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [domain, setDomain] = useState<"indian_recipe" | "non_cooking_diy" | "other">("indian_recipe");
  const [sampleId, setSampleId] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function takeFile(next: File | null) {
    if (!next) return;
    if (!["video/mp4", "video/webm"].includes(next.type) && !/\.(mp4|webm)$/i.test(next.name)) {
      setNote("Use an MP4 or WebM file you filmed.");
      return;
    }
    setNote(null);
    setFile(next);
    setSampleId(null);
  }

  async function extract() {
    if (!file && !sampleId) return;
    let durationSec: number | undefined;
    let url: string | null = null;
    if (file) {
      url = URL.createObjectURL(file);
      durationSec = await readDuration(url);
    }
    const sample = SAMPLES.find((item) => item.id === sampleId);
    session.setPrepare({
      key: file ? `file:${file.name}:${file.size}:${credit}` : `demo:${sampleId}:${credit}`,
      sampleId: sampleId ?? undefined,
      transcript: transcript.trim() || undefined,
      title: title.trim() || sample?.title,
      domain: sample?.domain ?? domain,
      filename: file?.name,
      creditLine: credit.trim() || "Sample · self-filmed",
      durationSec,
    }, url);
    router.push("/extracting");
  }

  const ready = Boolean(file || sampleId);

  return (
    <AppShell mock={session.runtime.mock}>
      <main className="screen upload-screen">
        <div className="upload-grid">
          <section>
            <h1>Upload a tutorial</h1>
            <p className="lead">A clip you filmed, or one you are allowed to use.</p>
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
              <small>Short clip. It stays in this browser until you close the tab.</small>
              <input
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {note ? <p className="form-note">{note}</p> : null}
            <label className="field-label">
              Credit label
              <input className="field" value={credit} onChange={(event) => setCredit(event.target.value)} />
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
              Transcript for Spark
              <textarea className="field" rows={4} value={transcript} placeholder="Optional. Spark reads this once." onChange={(event) => setTranscript(event.target.value)} />
            </label>
            <div className="sample-pick">
              <p className="mono">Or start from a Sample</p>
              {SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className={sampleId === sample.id ? "sample-row is-on" : "sample-row"}
                  onClick={() => { setSampleId(sample.id); setFile(null); }}
                >
                  <Chip tone="neutral">Sample</Chip>
                  {sample.title}
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
            <p>2–4 objects work best. Good light. Hands can enter, but each tracked object stays fully inside the frame.</p>
            <p>Gate 0 missed the cup because it sat outside the shot. If a noun is not masked, move it in before you continue.</p>
            <p className="mono">muse-spark-1.3 runs once here. sam-3.1 runs later, on keyframes.</p>
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
