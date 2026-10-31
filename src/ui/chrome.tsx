import Link from "next/link";
import { SparkMark } from "./mark";

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
  mock,
}: {
  children: React.ReactNode;
  backHref?: string;
  mock?: boolean;
}) {
  return (
    <div className="app-shell">
      <header className="app-bar">
        {backHref ? <Link className="back" href={backHref}>Back</Link> : <span />}
        <Link href="/" className="wordmark"><SparkMark /> Reel2Real</Link>
        <span className="model-chip">sam-3.1</span>
      </header>
      <p className="honesty-strip">
        <span>Sample data</span>
        <span>Keyframe mode labelled</span>
        {mock ? <Chip tone="mock">Mock</Chip> : null}
        <span>No secrets in the UI</span>
      </p>
      {children}
    </div>
  );
}
