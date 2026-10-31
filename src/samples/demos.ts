import { fitDemo, type FrameShapeId } from "@/src/samples/frame-fit";
import type { FrameBox, ObjectPosition } from "@/src/samples/mask-geometry";
import type { SampleScene } from "@/src/samples/scene";
import type { TutorialSteps } from "@/src/schema/types";
import recordedBoxes from "@/src/samples/recorded-boxes.json";
import chaiSceneJson from "../../public/samples/masala-chai/steps.json";

/**
 * One record per Sample reel. Adding a demo is a new entry here plus files under public/samples/<slug>/.
 * Boxes come from src/samples/recorded-boxes.json, which scripts/sync-sample-boxes.ts rebuilds from the sam files.
 * Shape and crops come from fitDemo. See docs/ADD-A-DEMO.md.
 */
export interface DemoCredit {
  name: string;
  license: string;
  href: string;
  /** Licence summary page. The card links this when it is set. */
  licenseHref?: string;
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
  /** Shown on the demo card and the coach. Kids science uses "Grown-up supervision". */
  safetyNote?: string;
}

interface DemoInput {
  slug: string;
  domain: DemoDefinition["domain"];
  scene: SampleScene;
  credit: DemoCredit;
  safetyNote?: string;
}

function boxesFor(slug: string): FrameBox[][] {
  const rows = (recordedBoxes as Record<string, FrameBox[][]>)[slug];
  if (!rows) {
    throw new Error(`Recorded boxes missing for ${slug}. Run: npx tsx scripts/sync-sample-boxes.ts`);
  }
  return rows;
}

export function defineDemo(input: DemoInput): DemoDefinition {
  if (input.scene.demo !== input.slug) {
    throw new Error(`${input.slug} steps.json says demo ${input.scene.demo}`);
  }
  const boxes = boxesFor(input.slug);
  const fit = fitDemo(boxes);
  return {
    slug: input.slug,
    title: input.scene.title,
    domain: input.domain,
    clip: "hero-loop.mp4",
    poster: input.scene.hero.image,
    credit: input.credit,
    scene: input.scene,
    boxes,
    shape: fit.shape,
    crop: fit.steps[0]?.position ?? { x: 0.5, y: 0.5 },
    zoom: fit.steps[0]?.zoom ?? 1,
    stepCrops: fit.steps.map((step) => step.position),
    stepZooms: fit.steps.map((step) => step.zoom),
    stepTitle: fit.stepTitle,
    cardCrop: fit.card.position,
    cardZoom: fit.card.zoom,
    cardOutlines: fit.card.outlines,
    safetyNote: input.safetyNote?.trim() || undefined,
  };
}

const chai = chaiSceneJson as SampleScene;

export const DEMOS: DemoDefinition[] = [
  defineDemo({
    slug: "masala-chai",
    domain: "indian_recipe",
    scene: chai,
    credit: {
      name: "Pexels contributor",
      license: "Pexels License",
      href: "https://www.pexels.com/video/5480225/",
      licenseHref: "https://www.pexels.com/license/",
    },
  }),
];

export function demoBySlug(slug: string | null | undefined): DemoDefinition | undefined {
  if (!slug) return undefined;
  return DEMOS.find((demo) => demo.slug === slug || demo.scene.demo === slug);
}

export function cropForStep(demo: DemoDefinition, index: number): ObjectPosition {
  return demo.stepCrops[index] ?? demo.crop;
}
