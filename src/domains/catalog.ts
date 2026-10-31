import chai from "@/src/fixtures/sample-masala-chai.steps.json";
import secondDomain from "@/src/fixtures/sample-bike-chain.steps.json";
import type { TutorialSteps } from "@/src/schema/types";

export type SampleFrame = "chai" | "bike";

export interface PublishedSample {
  id: string;
  domain: NonNullable<TutorialSteps["domain"]>;
  frame: SampleFrame;
  creatorName: string;
  tutorial: TutorialSteps;
}

/**
 * The non-cooking slot. Swap this entry when the second domain is chosen.
 * Step copy stays in the fixture, not in the screens.
 */
export const SECOND_DOMAIN: PublishedSample = {
  id: "bike-chain",
  domain: "non_cooking_diy",
  frame: "bike",
  creatorName: "Sample",
  tutorial: secondDomain as TutorialSteps,
};

export const PUBLISHED_SAMPLES: PublishedSample[] = [
  {
    id: "masala-chai",
    domain: "indian_recipe",
    frame: "chai",
    creatorName: "Sample cook",
    tutorial: chai as TutorialSteps,
  },
  SECOND_DOMAIN,
];

export function sampleByPublishedId(id: string | null | undefined): PublishedSample | undefined {
  if (!id) return undefined;
  return PUBLISHED_SAMPLES.find((item) => item.id === id || item.tutorial.tutorialId === id);
}

export function frameForDomain(domain: string | undefined): SampleFrame {
  return PUBLISHED_SAMPLES.find((item) => item.domain === domain)?.frame ?? "chai";
}
