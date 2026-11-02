import { sampleByPublishedId } from "@/src/domains/catalog";
import type { TutorialSteps } from "@/src/schema/types";

/** Where a finished spark hands off. Samples keep their id on the coach route. */
export function coachHref(sampleId: string | null | undefined, inputKind: string | null | undefined): string {
  if (inputKind === "sample" && sampleId) return `/coach?sample=${encodeURIComponent(sampleId)}`;
  return "/coach";
}

export function publishedSampleTutorial(sampleId: string | null | undefined): TutorialSteps | null {
  if (!sampleId) return null;
  return sampleByPublishedId(sampleId)?.tutorial ?? null;
}

/**
 * Redirect only after the session has committed, and only when nothing can open the coach.
 * A known sample id is enough on its own. An unknown id is not.
 */
export function coachShouldRedirect(input: {
  hydrated: boolean;
  hasTutorial: boolean;
  sampleId: string | null;
}): boolean {
  if (!input.hydrated) return false;
  if (input.hasTutorial) return false;
  if (input.sampleId && publishedSampleTutorial(input.sampleId)) return false;
  return true;
}
