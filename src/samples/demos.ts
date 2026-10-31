import { fitDemo, type FrameShapeId } from "@/src/samples/frame-fit";
import type { FrameBox, ObjectPosition } from "@/src/samples/mask-geometry";
import { sceneByDemo, type SampleScene } from "@/src/samples/scene";
import type { TutorialSteps } from "@/src/schema/types";

/**
 * One record per Sample reel. Adding a demo is a new entry here plus files under public/samples/<slug>/.
 * See docs/ADD-A-DEMO.md. Shape and crops come from fitDemo, not from hand-tuned numbers.
 */
export interface DemoCredit {
  name: string;
  license: string;
  href: string;
}

export interface DemoDefinition {
  slug: string;
  title: string;
  domain: NonNullable<TutorialSteps["domain"]>;
  clip: string;
  poster: string;
  credit: DemoCredit;
  scene: SampleScene;
  /** Highlighted mask boxes per step, in sam/step-*.json order. The fit reads these. */
  boxes: FrameBox[][];
  shape: FrameShapeId;
  /** object-position for the hero, which uses step 1's crop. */
  crop: ObjectPosition;
  zoom: number;
  stepCrops: ObjectPosition[];
  stepZooms: number[];
  stepTitle: Array<"overlay" | "below">;
  /** Demo grid cards are always 4:5. Outlines are omitted when they would be cut. */
  cardCrop: ObjectPosition;
  cardZoom: number;
  cardOutlines: boolean;
}

const chai = sceneByDemo("masala-chai");
if (!chai) throw new Error("masala-chai steps.json is missing");

/** Present-noun boxes from public/samples/masala-chai/sam/step-*.json. The catalog test checks this list. */
const CHAI_BOXES: FrameBox[][] = [
  [
    { x1: 221, y1: 85, x2: 568, y2: 380 },
    { x1: 100, y1: 0, x2: 217, y2: 250 },
  ],
  [
    { x1: 286, y1: 287, x2: 303, y2: 304 },
    { x1: 297, y1: 185, x2: 491, y2: 341 },
    { x1: 424, y1: 343, x2: 438, y2: 372 },
    { x1: 553, y1: 0, x2: 720, y2: 129 },
    { x1: 265, y1: 15, x2: 451, y2: 195 },
  ],
  [
    { x1: 395, y1: 309, x2: 408, y2: 336 },
    { x1: 389, y1: 197, x2: 467, y2: 306 },
  ],
];

const chaiFit = fitDemo(CHAI_BOXES);

export const DEMOS: DemoDefinition[] = [
  {
    slug: "masala-chai",
    title: chai.title,
    domain: "indian_recipe",
    clip: "hero-loop.mp4",
    poster: chai.hero.image,
    credit: {
      name: "Pexels contributor",
      license: "Pexels License",
      href: "https://www.pexels.com/video/5480225/",
    },
    scene: chai,
    boxes: CHAI_BOXES,
    shape: chaiFit.shape,
    crop: chaiFit.steps[0]?.position ?? { x: 0.5, y: 0.5 },
    zoom: chaiFit.steps[0]?.zoom ?? 1,
    stepCrops: chaiFit.steps.map((step) => step.position),
    stepZooms: chaiFit.steps.map((step) => step.zoom),
    stepTitle: chaiFit.stepTitle,
    cardCrop: chaiFit.card.position,
    cardZoom: chaiFit.card.zoom,
    cardOutlines: chaiFit.card.outlines,
  },
];

export function demoBySlug(slug: string | null | undefined): DemoDefinition | undefined {
  if (!slug) return undefined;
  return DEMOS.find((demo) => demo.slug === slug || demo.scene.demo === slug);
}

export function cropForStep(demo: DemoDefinition, index: number): ObjectPosition {
  return demo.stepCrops[index] ?? demo.crop;
}
