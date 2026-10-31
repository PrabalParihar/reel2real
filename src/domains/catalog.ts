import { DEMOS, type DemoDefinition } from "@/src/samples/demos";
import type { FrameShapeId } from "@/src/samples/frame-fit";
import { tutorialFromScene, type SampleScene } from "@/src/samples/scene";
import type { ObjectPosition } from "@/src/samples/mask-geometry";
import type { TutorialSteps } from "@/src/schema/types";

export type SampleFrame = "chai" | "reel";

export interface PublishedSample {
  id: string;
  domain: NonNullable<TutorialSteps["domain"]>;
  frame: SampleFrame;
  creatorName: string;
  scene: SampleScene;
  tutorial: TutorialSteps;
  clip: string;
  poster: string;
  shape: FrameShapeId;
  crop: ObjectPosition;
  zoom: number;
  stepCrops: ObjectPosition[];
  stepZooms: number[];
  stepTitle: Array<"overlay" | "below">;
  cardCrop: ObjectPosition;
  cardZoom: number;
  cardOutlines: boolean;
  demo: DemoDefinition;
}

function publish(demo: DemoDefinition): PublishedSample {
  return {
    id: demo.slug,
    domain: demo.domain,
    frame: "reel",
    creatorName: demo.credit.name,
    scene: demo.scene,
    tutorial: tutorialFromScene(demo.scene),
    clip: demo.clip,
    poster: demo.poster,
    shape: demo.shape,
    crop: demo.crop,
    zoom: demo.zoom,
    stepCrops: demo.stepCrops,
    stepZooms: demo.stepZooms,
    stepTitle: demo.stepTitle,
    cardCrop: demo.cardCrop,
    cardZoom: demo.cardZoom,
    cardOutlines: demo.cardOutlines,
    demo,
  };
}

/** Published Sample reels. Add a demo in src/samples/demos.ts only. */
export const PUBLISHED_SAMPLES: PublishedSample[] = DEMOS.map(publish);

export function sampleByPublishedId(id: string | null | undefined): PublishedSample | undefined {
  if (!id) return undefined;
  return PUBLISHED_SAMPLES.find((item) => item.id === id || item.tutorial.tutorialId === id || item.scene.demo === id);
}

export function frameForDomain(domain: string | undefined): SampleFrame {
  return PUBLISHED_SAMPLES.find((item) => item.domain === domain)?.frame ?? "reel";
}

export function sceneForPublishedId(id: string | null | undefined): SampleScene | undefined {
  return sampleByPublishedId(id)?.scene;
}
