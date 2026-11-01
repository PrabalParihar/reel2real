/** Maps muse-spark wording onto the strict steps schema. Samples do not use this. */

const DOMAIN: Record<string, string> = {
  indian_recipe: "indian_recipe",
  recipe: "indian_recipe",
  cooking: "indian_recipe",
  food: "indian_recipe",
  kitchen: "indian_recipe",
  chai: "indian_recipe",
  non_cooking_diy: "non_cooking_diy",
  diy: "non_cooking_diy",
  craft: "non_cooking_diy",
  origami: "non_cooking_diy",
  other: "other",
  general: "other",
};

const MEDIA: Record<string, string> = {
  "video/mp4": "video/mp4",
  mp4: "video/mp4",
  "image/jpeg": "video/mp4",
  "image/jpg": "video/mp4",
  "image/png": "video/mp4",
  jpeg: "video/mp4",
  jpg: "video/mp4",
  still: "video/mp4",
  photo: "video/mp4",
  "video/webm": "video/webm",
  webm: "video/webm",
};

const ROLE: Record<string, string> = {
  required_present: "required_present",
  present: "required_present",
  required: "required_present",
  visible: "required_present",
  ingredient: "required_present",
  tool: "required_present",
  object: "required_present",
  item: "required_present",
  required_absent: "required_absent",
  absent: "required_absent",
  missing: "required_absent",
  optional: "optional",
  maybe: "optional",
  safety_prop: "safety_prop",
  safety: "safety_prop",
  hazard: "safety_prop",
};

const KIND: Record<string, string> = {
  all_required_present: "all_required_present",
  present: "all_required_present",
  visual: "all_required_present",
  visual_check: "all_required_present",
  highlight: "all_required_present",
  check: "all_required_present",
  objects_present: "all_required_present",
  required_present_and_absent: "required_present_and_absent",
  ordered_presence: "ordered_presence",
  ordered: "ordered_presence",
  sequence: "ordered_presence",
  order: "ordered_presence",
  manual_confirm_only: "manual_confirm_only",
  manual: "manual_confirm_only",
  confirm: "manual_confirm_only",
};

const TOOL: Record<string, string> = {
  muse_spark: "muse_spark",
  spark: "muse_spark",
  muse: "muse_spark",
  sam_3_1: "sam_3_1",
  sam: "sam_3_1",
  sam_3: "sam_3_1",
  tts: "tts",
  speech: "tts",
  other: "other",
};

const INPUT_KIND: Record<string, string> = {
  image: "image",
  photo: "image",
  still: "image",
  jpeg: "image",
  clip: "clip",
  video: "clip",
  transcript: "transcript",
  video_chunk: "video_chunk",
  chunk: "video_chunk",
  text: "text",
};

const MODE: Record<string, string> = {
  muse_spark_live: "muse_spark_live",
  live: "muse_spark_live",
  muse_spark_curated: "muse_spark_curated",
  curated: "muse_spark_curated",
  hand_authored: "hand_authored",
  hand: "hand_authored",
};

const LIVE_MODE: Record<string, string> = {
  keyframe_still: "keyframe_still",
  keyframe: "keyframe_still",
  still: "keyframe_still",
  camera: "keyframe_still",
  chunk_video_1_2s: "chunk_video_1_2s",
  chunk: "chunk_video_1_2s",
  stills_only: "stills_only",
  stills: "stills_only",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function lookup(table: Record<string, string>, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return table[key] ?? table[value.trim().toLowerCase()];
}

function assign(record: Record<string, unknown>, key: string, table: Record<string, string>) {
  const mapped = lookup(table, record[key]);
  if (mapped) record[key] = mapped;
}

export function instructTutorialId(goal: string): string {
  const slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `instruct-${slug || "goal"}`;
}

function repairTimes(record: Record<string, unknown>) {
  const steps = Array.isArray(record.steps) ? record.steps : [];
  const clip = asRecord(record.sourceClip) ?? {};
  record.sourceClip = clip;
  const duration = typeof clip.durationSec === "number" ? clip.durationSec : 0;
  const broken = duration <= 0 || steps.some((step) => {
    const end = asRecord(asRecord(step)?.sourceTimeRange)?.endSec;
    return typeof end !== "number" || end <= 0;
  });
  if (!broken) return;
  const next = Math.max(steps.length * 8, 8);
  clip.durationSec = next;
  if (!clip.mediaType) clip.mediaType = "video/mp4";
  const slice = next / Math.max(steps.length, 1);
  steps.forEach((step, index) => {
    const item = asRecord(step);
    if (!item) return;
    item.sourceTimeRange = {
      startSec: Number((index * slice).toFixed(2)),
      endSec: Number(((index + 1) * slice).toFixed(2)),
    };
  });
}

function mapToolCalls(value: unknown) {
  if (!Array.isArray(value)) return;
  for (const call of value) {
    const record = asRecord(call);
    if (!record) continue;
    assign(record, "tool", TOOL);
    assign(record, "inputKind", INPUT_KIND);
  }
}

/** Fills tutorialId and maps known synonyms. Unknown enum values are left for a 422. */
export function coerceInstructDocument(payload: unknown, goal: string): unknown {
  const copy = structuredClone(payload);
  const record = asRecord(copy);
  if (!record) return payload;
  const basis = typeof record.title === "string" && record.title.trim() ? record.title : goal;
  if (typeof record.tutorialId !== "string" || !record.tutorialId.trim()) {
    record.tutorialId = instructTutorialId(basis);
  }
  assign(record, "domain", DOMAIN);
  const clip = asRecord(record.sourceClip);
  if (clip) assign(clip, "mediaType", MEDIA);
  const generation = asRecord(record.generation);
  if (generation) {
    assign(generation, "mode", MODE);
    mapToolCalls(generation.toolCalls);
  }
  const hints = asRecord(record.runtimeHints);
  if (hints) assign(hints, "preferredLiveMode", LIVE_MODE);
  repairTimes(record);
  if (Array.isArray(record.steps)) {
    for (const step of record.steps) {
      const item = asRecord(step);
      if (!item) continue;
      if (Array.isArray(item.objects)) {
        for (const object of item.objects) {
          const row = asRecord(object);
          if (row) assign(row, "role", ROLE);
        }
      }
      const check = asRecord(item.successCheck);
      if (check) assign(check, "kind", KIND);
      const stepGeneration = asRecord(item.generation);
      if (stepGeneration) mapToolCalls(stepGeneration.toolCalls);
    }
  }
  return copy;
}
