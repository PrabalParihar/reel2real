import Link from "next/link";

export const LIVE_COACHING_OFF_TITLE = "Live coaching is off right now.";
export const LIVE_COACHING_OFF_BODY = "Try a Sample.";
/** Home section that lists the recorded Samples. */
export const SAMPLES_HREF = "/#demos";

export function isLiveCoachingOff(body: { mode?: string | null; refused?: boolean }): boolean {
  if (body.refused) return false;
  return body.mode === "degraded";
}

/** Distinct from the error panel and the refusal panel. */
export function LiveCoachingOff() {
  return (
    <section className="live-off panel" role="status">
      <h1>{LIVE_COACHING_OFF_TITLE}</h1>
      <p>{LIVE_COACHING_OFF_BODY}</p>
      <Link className="btn btn-primary" href={SAMPLES_HREF}>Try a Sample</Link>
    </section>
  );
}
