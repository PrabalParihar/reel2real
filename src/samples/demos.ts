import { type ObjectPosition } from "@/src/samples/mask-geometry";
import { sceneByDemo, type SampleScene } from "@/src/samples/scene";
import type { TutorialSteps } from "@/src/schema/types";

/**
 * One record per Sample reel. Adding a demo is a new entry here plus files under public/samples/<slug>/.
 * See docs/ADD-A-DEMO.md.
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
  /** object-position for a cover crop inside the 5:4 stage. 0 shows the left edge, 1 the right. */
  crop: ObjectPosition;
  /** Always 1. Cover fills the frame. A value below 1 letterboxes. */
  zoom: number;
  /** Cover position per step index, same 5:4 stage. */
  stepCrops: ObjectPosition[];
}

const chai = sceneByDemo("masala-chai");
if (!chai) throw new Error("masala-chai steps.json is missing");

/**
 * 5:4 cover of the 720×405 frame. 9:16 shows ~228px of width and 4:5 shows ~324px.
 * The pestle and mortar together span x 100–568, so only 5:4 (about 506px) holds both,
 * plus the hand on the crush step. Zoom stays 1 so the frame never letterboxes.
 */
const CHAI_LAYOUT: ObjectPosition = { x: 0.3784, y: 0.5 };
const CHAI_CRUSH: ObjectPosition = { x: 1, y: 0.5 };
const CHAI_ZOOM = 1;

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
    crop: CHAI_LAYOUT,
    zoom: CHAI_ZOOM,
    stepCrops: [CHAI_LAYOUT, CHAI_CRUSH, CHAI_LAYOUT],
  },
];

export function demoBySlug(slug: string | null | undefined): DemoDefinition | undefined {
  if (!slug) return undefined;
  return DEMOS.find((demo) => demo.slug === slug || demo.scene.demo === slug);
}

export function cropForStep(demo: DemoDefinition, index: number): ObjectPosition {
  return demo.stepCrops[index] ?? demo.crop;
}
