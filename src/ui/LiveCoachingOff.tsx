import Link from "next/link";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import { sceneAsset } from "@/src/samples/scene";

export const LIVE_COACHING_OFF_TITLE = "Live coaching is off right now.";
export const LIVE_COACHING_OFF_BODY = "Recorded Samples still show every step.";
/** Full Sample list on the home page. */
export const SAMPLES_HREF = "/#demos";
/** Chai, latte, and origami. The flask Sample stays off this card. */
export const LIVE_OFF_SAMPLE_IDS = ["masala-chai", "latte-art", "origami"] as const;

const GOAL_ECHO_MAX = 72;

export function isLiveCoachingOff(body: { mode?: string | null; refused?: boolean }): boolean {
  if (body.refused) return false;
  return body.mode === "degraded";
}

/** Plain text only. The component renders it as text, so markup stays escaped. */
export function goalEcho(goal: string, max = GOAL_ECHO_MAX): string {
  const clean = goal.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const shown = clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}...` : clean;
  return `Your goal: ${shown}`;
}

export interface LiveOffSampleCard {
  id: string;
  title: string;
  href: string;
  image: string;
}

export function liveOffSampleCards(): LiveOffSampleCard[] {
  return LIVE_OFF_SAMPLE_IDS.flatMap((id) => {
    const sample = PUBLISHED_SAMPLES.find((item) => item.id === id);
    if (!sample) return [];
    return [{
      id: sample.id,
      title: sample.tutorial.title.replace(/^Sample · /, ""),
      href: `/extracting?demo=${sample.id}`,
      image: sceneAsset(sample.scene, sample.poster),
    }];
  });
}

/** Distinct from the error panel and the refusal panel. */
export function LiveCoachingOff({
  goal,
  onEdit,
  backHref,
}: {
  goal?: string;
  onEdit?: () => void;
  backHref?: string;
}) {
  const echo = goal ? goalEcho(goal) : "";
  const samples = liveOffSampleCards();
  return (
    <section className="live-off panel" role="status">
      <h1>{LIVE_COACHING_OFF_TITLE}</h1>
      <p>{LIVE_COACHING_OFF_BODY}</p>
      {echo ? <p className="live-off-goal">{echo}</p> : null}
      {echo && onEdit ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>Edit goal</button>
      ) : null}
      {!echo && backHref ? (
        <Link className="btn btn-ghost btn-sm" href={backHref}>Edit</Link>
      ) : null}
      <Link className="btn btn-primary" href={SAMPLES_HREF}>Try a Sample</Link>
      <ul className="live-off-samples">
        {samples.map((sample) => (
          <li key={sample.id}>
            <Link href={sample.href}>
              <img src={sample.image} alt="" />
              <span className="live-off-sample-label">Sample</span>
              <span className="live-off-sample-title">{sample.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
