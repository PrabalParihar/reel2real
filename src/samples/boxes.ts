import type { FrameBox } from "@/src/samples/mask-geometry";
import type { SampleScene, SceneNoun } from "@/src/samples/scene";

interface SamBox {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

interface SamFile {
  calls?: Array<{
    noun?: string;
    requestId?: string;
    present?: boolean;
    records?: Array<{ box?: SamBox; verified?: boolean; ordinal?: string | number }>;
  }>;
}

function asSamFile(value: unknown): SamFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SamFile;
}

function matchingCall(file: SamFile, noun: SceneNoun) {
  const calls = file.calls ?? [];
  return calls.find((call) => noun.requestId && call.requestId === noun.requestId)
    ?? calls.find((call) => call.noun === noun.noun || call.noun === noun.samPrompt);
}

/**
 * Present-noun boxes from a demo's sam/step-*.json files, in step order.
 * A step with no calls, or a noun with no box, contributes nothing. No box is invented.
 */
export function highlightedBoxes(scene: SampleScene, files: Record<string, unknown>): FrameBox[][] {
  return scene.steps.map((step) => {
    const file = asSamFile(files[step.samFile]);
    const boxes: FrameBox[] = [];
    const seen = new Set<string>();
    for (const noun of step.nouns) {
      if (!noun.present || noun.verified !== true) continue;
      const call = matchingCall(file, noun);
      if (!call || call.present === false) continue;
      for (const record of call.records ?? []) {
        if (record.verified === false) continue;
        const box = record.box;
        if (!box || box.x1 == null || box.y1 == null || box.x2 == null || box.y2 == null) continue;
        if (![box.x1, box.y1, box.x2, box.y2].every((value) => Number.isFinite(value))) continue;
        const key = `${call.requestId ?? call.noun ?? ""}:${record.ordinal ?? ""}:${box.x1},${box.y1},${box.x2},${box.y2}`;
        if (seen.has(key)) continue;
        seen.add(key);
        boxes.push({ x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 });
      }
    }
    return boxes;
  });
}
