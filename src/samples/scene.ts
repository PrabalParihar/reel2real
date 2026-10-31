import type { TutorialSteps } from "@/src/schema/types";
import chaiSceneJson from "../../public/samples/masala-chai/steps.json";

export const RECORDED_SAM_LABEL = "Sample · recorded SAM output";
export const SAM_FRAME = { width: 720, height: 405 } as const;

export interface SceneNoun {
  objectId: string;
  noun: string;
  samPrompt: string;
  color: string;
  present: boolean;
  requestId?: string;
}

export interface SceneStep {
  index: number;
  id: string;
  title: string;
  instruction: string;
  hinglishPrompt?: string;
  keyframe: string;
  samFile: string;
  nouns: SceneNoun[];
  notes?: string;
}

export interface SampleScene {
  demo: string;
  title: string;
  label: string;
  sourceClip: {
    file: string;
    pexelsId: string;
    page: string;
    author: string;
    license: string;
  };
  hero: {
    image: string;
    samNoun?: string;
    samStep?: number;
    samPrompt?: string;
  };
  steps: SceneStep[];
}

export interface SamBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frameW?: number;
  frameH?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

export interface SamMaskPayload {
  encoding: "one_bit" | "lossless";
  width: number;
  height: number;
  payload: string;
}

export interface SamRecord {
  box?: SamBox;
  maskPayload?: SamMaskPayload;
}

export interface SamCall {
  objectId?: string;
  noun?: string;
  present?: boolean;
  requestId?: string;
  samImageSize?: { w?: number; h?: number };
  records?: SamRecord[];
}

export interface SamStepFile {
  label?: string;
  calls?: SamCall[];
}

const DOMAIN_BY_DEMO: Record<string, NonNullable<TutorialSteps["domain"]>> = {
  "masala-chai": "indian_recipe",
};

export const SAMPLE_SCENES: SampleScene[] = [
  chaiSceneJson as SampleScene,
];

export function sceneByDemo(id: string | null | undefined): SampleScene | undefined {
  if (!id) return undefined;
  return SAMPLE_SCENES.find((scene) => scene.demo === id);
}

export function sceneAsset(scene: SampleScene, file: string): string {
  const clean = file.replace(/^\/+/, "");
  return `/samples/${scene.demo}/${clean}`;
}

export function presentNouns(step: SceneStep | undefined): SceneNoun[] {
  return (step?.nouns ?? []).filter((noun) => noun.present !== false && noun.noun.trim());
}

export function heroStep(scene: SampleScene): SceneStep | undefined {
  const index = Math.max(0, (scene.hero.samStep ?? 1) - 1);
  return scene.steps[index] ?? scene.steps[0];
}

/** Nouns drawn on the hero. Matches samNoun / samPrompt from steps.json, hits only. */
export function heroNouns(scene: SampleScene): SceneNoun[] {
  const step = heroStep(scene);
  const nouns = presentNouns(step);
  const wanted = scene.hero.samNoun?.trim().toLowerCase();
  const prompt = scene.hero.samPrompt?.trim().toLowerCase();
  if (!wanted && !prompt) return nouns;
  const match = nouns.filter((noun) => {
    const name = noun.noun.toLowerCase();
    const sam = noun.samPrompt.toLowerCase();
    return name === wanted || sam === wanted || name === prompt || sam === prompt;
  });
  return match.length ? match : nouns;
}

export function heroSamFile(scene: SampleScene): string | undefined {
  return heroStep(scene)?.samFile;
}

export function creditLineForScene(scene: SampleScene): string {
  const author = scene.sourceClip.author.trim();
  const page = scene.sourceClip.page.trim();
  return page ? `${author} · Pexels License · ${page}` : `${author} · Pexels License`;
}

/** Build the coach tutorial from a demo's public steps.json. Swapping that file is enough. */
export function tutorialFromScene(scene: SampleScene): TutorialSteps {
  const span = 10;
  const durationSec = Math.max(scene.steps.length * span, span);
  const domain = DOMAIN_BY_DEMO[scene.demo] ?? "other";
  const creditLine = creditLineForScene(scene);
  const creatorName = scene.sourceClip.author.trim() || "Sample";
  return {
    schemaVersion: "1.0.0",
    tutorialId: `sample_${scene.demo.replace(/[^a-z0-9]+/gi, "_")}_v2`,
    title: scene.title,
    domain,
    sampleLabel: true,
    attribution: {
      creatorName,
      creditLine,
      licence: "other_cleared",
    },
    sourceClip: {
      mediaType: "video/mp4",
      durationSec,
      localUri: `public/samples/${scene.demo}/hero-loop.mp4`,
      width: 1280,
      height: 720,
    },
    generation: {
      mode: "hand_authored",
      modelId: "sam-3.1",
      generatedAtIso: "2026-10-31T10:30:00.000Z",
      toolCalls: scene.steps.flatMap((step) => presentNouns(step).map((noun) => ({
        tool: "sam_3_1" as const,
        modelId: "sam-3.1",
        purpose: `recorded_mask_${noun.noun}`,
        requestId: noun.requestId,
        inputKind: "image" as const,
      }))),
    },
    runtimeHints: {
      preferredLiveMode: "keyframe_still",
      maxObjectsPerStep: 4,
    },
    steps: scene.steps.map((step, index) => {
      const nouns = presentNouns(step);
      const objects = nouns.map((noun) => ({
        objectId: noun.objectId,
        noun: noun.noun,
        role: "required_present" as const,
        samPrompt: noun.samPrompt,
        expectedTrack: true,
      }));
      const requiredObjectIds = objects.map((object) => object.objectId);
      return {
        id: step.id,
        index,
        instructionText: step.title,
        hinglishPrompt: step.hinglishPrompt,
        sourceTimeRange: {
          startSec: index * span,
          endSec: (index + 1) * span,
          description: step.instruction,
        },
        credit: {
          creditLine,
          creatorName,
          sampleLabel: true,
        },
        objects,
        successCheck: nouns.length
          ? {
            kind: "all_required_present" as const,
            description: step.instruction,
            requiredObjectIds,
            minStableChunks: 1,
          }
          : {
            kind: "manual_confirm_only" as const,
            description: "No recorded highlight on this frame. Press Next when the step looks right.",
            minStableChunks: 1,
          },
      };
    }),
  };
}

export function placementBox(record: SamRecord, call: SamCall): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frameW: number;
  frameH: number;
} | null {
  const box = record.box;
  if (!box) return null;
  const x1 = box.x1 ?? box.left;
  const y1 = box.y1 ?? box.top;
  const x2 = box.x2 ?? box.right;
  const y2 = box.y2 ?? box.bottom;
  if (![x1, y1, x2, y2].every((value) => typeof value === "number" && Number.isFinite(value))) return null;
  if (x2! <= x1! || y2! <= y1!) return null;
  return {
    x1: x1!,
    y1: y1!,
    x2: x2!,
    y2: y2!,
    frameW: box.frameW || call.samImageSize?.w || SAM_FRAME.width,
    frameH: box.frameH || call.samImageSize?.h || SAM_FRAME.height,
  };
}

/** Hits only. A miss with the same object id must not steal the recorded mask. */
export function selectMaskRecord(calls: SamCall[] | undefined, noun: SceneNoun): {
  call: SamCall;
  record: SamRecord;
  box: NonNullable<ReturnType<typeof placementBox>>;
  mask: SamMaskPayload;
} | null {
  if (!noun.present) return null;
  const list = calls ?? [];
  const ranked = [
    ...list.filter((call) => noun.requestId && call.requestId === noun.requestId),
    ...list.filter((call) => call.noun === noun.noun || call.noun === noun.samPrompt || call.objectId === noun.objectId),
  ];
  const seen = new Set<SamCall>();
  for (const call of ranked) {
    if (seen.has(call)) continue;
    seen.add(call);
    if (call.present === false) continue;
    for (const record of call.records ?? []) {
      const mask = record.maskPayload;
      if (!mask?.payload || !mask.width || !mask.height) continue;
      const box = placementBox(record, call);
      if (!box) continue;
      return { call, record, box, mask };
    }
  }
  return null;
}
