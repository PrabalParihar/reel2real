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
        <span className="bar-end">
          <Chip tone={mock ? "wait" : "match"}>{mock ? "Sample mode" : "Live"}</Chip>
        </span>
      </header>
      {children}
    </div>
  );
}
