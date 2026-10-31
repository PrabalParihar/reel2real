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
  /** Cover position for the hero loop inside a 9:16 stage. */
  crop: ObjectPosition;
  /** 1 is a full cover crop. Below 1 zooms out so more of the 16:9 frame stays in the phone. */
  zoom: number;
  /** Cover position per step index, same 9:16 stage. */
  stepCrops: ObjectPosition[];
}

const chai = sceneByDemo("masala-chai");
if (!chai) throw new Error("masala-chai steps.json is missing");

/** Wide enough that the pestle, mortar, and hand all stay inside the 9:16 phone. */
const CHAI_CROP: ObjectPosition = { x: 0.02, y: 0.42 };
const CHAI_ZOOM = 0.52;

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
    crop: CHAI_CROP,
    zoom: CHAI_ZOOM,
    stepCrops: [CHAI_CROP, CHAI_CROP, CHAI_CROP],
  },
];

export function demoBySlug(slug: string | null | undefined): DemoDefinition | undefined {
  if (!slug) return undefined;
  return DEMOS.find((demo) => demo.slug === slug || demo.scene.demo === slug);
}

export function cropForStep(demo: DemoDefinition, index: number): ObjectPosition {
  return demo.stepCrops[index] ?? demo.crop;
}
