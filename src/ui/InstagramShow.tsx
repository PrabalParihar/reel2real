"use client";

import { useEffect, useRef, useState } from "react";
import { IG_BAD_URL, IG_FAIL, IG_FIELD_LABEL, IG_SAVE_HINT, IG_SECTION_TITLE, IG_SHOW } from "@/src/instagram/copy";
import { parsePublicInstagramUrl } from "@/src/instagram/url";

interface ShowResult {
  ok?: boolean;
  html?: string;
  authorName?: string;
  providerName?: string;
  message?: string;
}

function creditLine(authorName?: string, providerName?: string): string {
  const author = authorName?.trim();
  const provider = providerName?.trim() || "Instagram";
  return author ? `Credit · ${author} · ${provider}` : `Credit · ${provider}`;
}

export function InstagramShow() {
  const [value, setValue] = useState("");
  const [html, setHtml] = useState<string | null>(null);
  const [credit, setCredit] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = html ?? "";
    if (!html) return;
    const win = window as Window & { instgrm?: { Embeds: { process: () => void } } };
    const process = () => win.instgrm?.Embeds.process();
    const existing = document.querySelector("script[data-ig-embed='1']");
    if (existing) {
      process();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.dataset.igEmbed = "1";
    script.onload = () => process();
    document.body.appendChild(script);
  }, [html]);

  async function show() {
    const permalink = parsePublicInstagramUrl(value);
    if (!permalink) {
      setHtml(null);
      setCredit(null);
      setNote(IG_BAD_URL);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/instagram-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: permalink }),
      });
      const data = (await response.json()) as ShowResult;
      if (!response.ok || !data.ok || !data.html) {
        setHtml(null);
        setCredit(null);
        setNote(data.message || IG_FAIL);
        return;
      }
      setHtml(data.html);
      setCredit(creditLine(data.authorName, data.providerName));
    } catch {
      setHtml(null);
      setCredit(null);
      setNote(IG_FAIL);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ig-section panel" aria-labelledby="ig-heading">
      <h2 id="ig-heading">{IG_SECTION_TITLE}</h2>
      <label className="field-label" htmlFor="ig-link">
        {IG_FIELD_LABEL}
        <input
          id="ig-link"
          className="field"
          value={value}
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.instagram.com/reel/..."
          onChange={(event) => {
            setValue(event.target.value);
            setNote(null);
          }}
        />
      </label>
      <p className="quiet">{IG_SAVE_HINT}</p>
      <button className="btn btn-ghost btn-sm" type="button" disabled={busy || !value.trim()} onClick={() => void show()}>
        {busy ? "Showing" : IG_SHOW}
      </button>
      {note ? <p className="form-note" role="status">{note}</p> : null}
      {credit ? <p className="credit">{credit}</p> : null}
      <div className="ig-embed" ref={hostRef} />
    </section>
  );
}
