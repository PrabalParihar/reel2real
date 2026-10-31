import { objectPositionForPoint, type ObjectPosition } from "@/src/samples/mask-geometry";
import { SAM_FRAME, sceneByDemo, type SampleScene } from "@/src/samples/scene";
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
  /** Cover position per step index, same 9:16 stage. */
  stepCrops: ObjectPosition[];
}

const PHONE = { width: 360, height: 640 };

function cropAt(focalX: number, focalY: number): ObjectPosition {
  return objectPositionForPoint(focalX, focalY, SAM_FRAME.width, SAM_FRAME.height, PHONE.width, PHONE.height);
}

const chai = sceneByDemo("masala-chai");
if (!chai) throw new Error("masala-chai steps.json is missing");

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
    crop: cropAt(260, 220),
    stepCrops: [
      cropAt(260, 220),
      cropAt(340, 250),
      cropAt(400, 260),
    ],
  },
];

export function demoBySlug(slug: string | null | undefined): DemoDefinition | undefined {
  if (!slug) return undefined;
  return DEMOS.find((demo) => demo.slug === slug || demo.scene.demo === slug);
}

export function cropForStep(demo: DemoDefinition, index: number): ObjectPosition {
  return demo.stepCrops[index] ?? demo.crop;
}
