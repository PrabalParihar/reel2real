"use client";

import Link from "next/link";
import { sessionStatusLabel } from "./session-status";
import { SparkMark } from "./mark";
import { useSession } from "./session";

export function Chip({
  children,
  tone = "neutral",
  pulse = false,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "saffron" | "mask" | "match" | "wait" | "danger" | "skip" | "running" | "mock";
  pulse?: boolean;
}) {
  return <span className={`chip tone-${tone}${pulse ? " is-pulse" : ""}`}>{children}</span>;
}

export function AppShell({
  children,
  backHref,
  appearance,
}: {
  children: React.ReactNode;
  backHref?: string;
  appearance?: "studio";
}) {
  const session = useSession();
  const sampleRun = session.stepsSource === "sample"
    || session.stepsSource === "cap_sample"
    || session.stepsSource === "transcript"
    || Boolean(session.prepare?.sampleId && !session.prepare.hasClip);
  const label = sessionStatusLabel({ source: session.stepsSource, provenance: session.resultProvenance, sampleRun });
  return (
    <div className={`app-shell${appearance === "studio" ? " studio-theme" : ""}`}>
      <header className="app-bar">
        {backHref ? <Link className="back" href={backHref}>Back</Link> : <span />}
        <Link href="/" className="wordmark"><SparkMark /> Reel2Real</Link>
        <span className="bar-end">
          {label ? <Chip tone={label === "Live" ? "match" : "wait"}>{label}</Chip> : null}
        </span>
      </header>
      {children}
    </div>
  );
}
