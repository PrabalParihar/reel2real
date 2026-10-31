import { sceneByDemo, SAMPLE_SCENES, tutorialFromScene, type SampleScene } from "@/src/samples/scene";
import type { TutorialSteps } from "@/src/schema/types";

export type SampleFrame = "chai" | "bike";

export interface PublishedSample {
  id: string;
  domain: NonNullable<TutorialSteps["domain"]>;
  frame: SampleFrame;
  creatorName: string;
  scene: SampleScene;
  tutorial: TutorialSteps;
}

function publish(scene: SampleScene, frame: SampleFrame): PublishedSample {
  const tutorial = tutorialFromScene(scene);
  return {
    id: scene.demo,
    domain: tutorial.domain ?? "other",
    frame,
    creatorName: scene.sourceClip.author,
    scene,
    tutorial,
  };
}

/**
 * The non-cooking slot. Titles, nouns, and keyframes come from
 * public/samples/bike-chain/steps.json.
 */
export const SECOND_DOMAIN: PublishedSample = publish(
  SAMPLE_SCENES.find((scene) => scene.demo === "bike-chain") ?? SAMPLE_SCENES[1],
  "bike",
);

export const PUBLISHED_SAMPLES: PublishedSample[] = [
  publish(SAMPLE_SCENES.find((scene) => scene.demo === "masala-chai") ?? SAMPLE_SCENES[0], "chai"),
  SECOND_DOMAIN,
];

export function sampleByPublishedId(id: string | null | undefined): PublishedSample | undefined {
  if (!id) return undefined;
  return PUBLISHED_SAMPLES.find((item) => item.id === id || item.tutorial.tutorialId === id);
}

export function frameForDomain(domain: string | undefined): SampleFrame {
  return PUBLISHED_SAMPLES.find((item) => item.domain === domain)?.frame ?? "chai";
}

export function sceneForPublishedId(id: string | null | undefined): SampleScene | undefined {
  return sampleByPublishedId(id)?.scene ?? sceneByDemo(id);
}
