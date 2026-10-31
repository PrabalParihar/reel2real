"use client";

import Link from "next/link";
import { headerChip } from "@/src/fsm/ui";
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
}: {
  children: React.ReactNode;
  backHref?: string;
}) {
  const session = useSession();
  const sampleRun = session.stepsSource === "sample"
    || session.stepsSource === "cap_sample"
    || session.stepsSource === "transcript"
    || Boolean(session.prepare?.sampleId && !session.prepare.hasClip);
  const liveClip = Boolean(session.prepare?.hasClip)
    && !session.prepare?.sampleId
    && (session.stepsSource === "clip" || session.stepsSource === "cache" || session.stepsSource == null);
  const label = headerChip({ mock: session.runtime.mock, sampleRun, liveClip });
  return (
    <div className="app-shell">
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
