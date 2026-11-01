/** Instruct-only tolerance. Samples keep the strict schema and do not use this. */

export const INSTRUCT_CLIP_MEDIA = "video/mp4" as const;
/** Small positive stand-in. A still has no clip length. */
export const INSTRUCT_CLIP_SEC = 8;

const RECIPE = /recipe|cook|food|kitchen|chai|indian/;

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

const ROOT_KEYS = ["schemaVersion", "tutorialId", "title", "domain", "sampleLabel", "attribution", "sourceClip", "generation", "runtimeHints", "steps"];
const CLIP_KEYS = ["mediaType", "durationSec", "localUri", "width", "height"];
const GENERATION_KEYS = ["mode", "modelId", "apiBaseHint", "promptDigest", "generatedAtIso", "toolCalls"];
const TOOL_KEYS = ["tool", "modelId", "purpose", "requestId", "inputKind", "latencyMs"];
const HINT_KEYS = ["preferredLiveMode", "maxObjectsPerStep", "safetyRuleId"];
const STEP_KEYS = ["id", "index", "instructionText", "hinglishPrompt", "sourceTimeRange", "credit", "objects", "successCheck", "safety", "generation"];
const OBJECT_KEYS = ["objectId", "noun", "role", "samPrompt", "expectedTrack"];
const CHECK_KEYS = ["kind", "description", "requiredObjectIds", "forbiddenObjectIds", "orderObjectIds", "minStableChunks"];
export interface InstructCoercion {
  path: string;
  value: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function preview(value: unknown): string {
  let text = "";
  try {
    text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  } catch {
    text = "";
  }
  text = text.replace(/\s+/g, " ");
  if (text.length > 80) text = `${text.slice(0, 80)}...`;
  return text;
}

function note(notes: InstructCoercion[], path: string, value: unknown) {
  notes.push({ path, value: preview(value) });
}

function lookup(table: Record<string, string>, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return table[key] ?? table[value.trim().toLowerCase()];
}

function keep(record: Record<string, unknown>, allowed: string[], path: string, notes: InstructCoercion[]) {
  for (const key of Object.keys(record)) {
    if (allowed.includes(key)) continue;
    note(notes, `${path}/${key}`, record[key]);
    delete record[key];
  }
}

/** Required enum: known word, else the safe default. Optional enum: drop the field. */
function enumField(
  record: Record<string, unknown>,
  key: string,
  table: Record<string, string>,
  path: string,
  notes: InstructCoercion[],
  requiredDefault?: string,
) {
  if (!(key in record)) {
    if (requiredDefault) record[key] = requiredDefault;
    return;
  }
  const original = record[key];
  const mapped = lookup(table, original);
  if (mapped) {
    if (mapped !== original) note(notes, `${path}/${key}`, original);
    record[key] = mapped;
    return;
  }
  note(notes, `${path}/${key}`, original);
  if (requiredDefault) record[key] = requiredDefault;
  else delete record[key];
}

export function instructTutorialId(goal: string): string {
  const slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return `instruct-${slug || "goal"}`;
}

function looksLikeRecipe(value: unknown): boolean {
  return typeof value === "string" && RECIPE.test(value.toLowerCase());
}

function chooseDomain(value: unknown, goal: string, title: string): string {
  const mapped = lookup(DOMAIN, value);
  if (mapped) return mapped;
  if (looksLikeRecipe(value) || (value == null && RECIPE.test(`${goal} ${title}`.toLowerCase()))) return "indian_recipe";
  return "non_cooking_diy";
}

export function instructStructureProblem(payload: unknown): string | null {
  const record = asRecord(payload);
  const steps = record && Array.isArray(record.steps) ? record.steps : [];
  if (!steps.length) return "The plan needs at least one step.";
  const usable = steps.some((step) => {
    const objects = asRecord(step)?.objects;
    if (!Array.isArray(objects)) return false;
    return objects.some((object) => {
      if (typeof object === "string" && object.trim()) return true;
      const row = asRecord(object);
      const noun = row?.noun ?? row?.name ?? row?.text;
      return typeof noun === "string" && noun.trim().length > 0;
    });
  });
  if (!usable) return "The plan needs at least one object.";
  return null;
}

function serverToolCall() {
  return {
    tool: "muse_spark",
    modelId: "muse-spark-1.3",
    purpose: "goal_still_to_steps_json",
    inputKind: "image",
  };
}

/** Fills server-owned clip fields and defaults any enum the model invents. */
export function coerceInstructDocument(payload: unknown, goal: string): { value: unknown; coercions: InstructCoercion[] } {
  const notes: InstructCoercion[] = [];
  const copy = structuredClone(payload);
  const record = asRecord(copy);
  if (!record) return { value: payload, coercions: notes };
  keep(record, ROOT_KEYS, "", notes);
  const basis = typeof record.title === "string" && record.title.trim() ? record.title : goal;
  if (typeof record.schemaVersion === "string" && record.schemaVersion !== "1.0.0") {
    note(notes, "/schemaVersion", record.schemaVersion);
    record.schemaVersion = "1.0.0";
  }
  if (typeof record.tutorialId !== "string" || !record.tutorialId.trim()) {
    if ("tutorialId" in record) note(notes, "/tutorialId", record.tutorialId);
    record.tutorialId = instructTutorialId(basis);
  }
  if (typeof record.title !== "string" || !record.title.trim()) record.title = basis.slice(0, 80) || "Instruction mode";
  const domain = chooseDomain(record.domain, goal, typeof record.title === "string" ? record.title : "");
  if ("domain" in record && record.domain !== domain) note(notes, "/domain", record.domain);
  record.domain = domain;

  const clip = asRecord(record.sourceClip) ?? {};
  if (record.sourceClip !== undefined && !asRecord(record.sourceClip)) note(notes, "/sourceClip", record.sourceClip);
  const sentPlaceholder = clip.stillPlaceholder;
  keep(clip, CLIP_KEYS, "/sourceClip", notes);
  if ("mediaType" in clip && clip.mediaType !== INSTRUCT_CLIP_MEDIA) note(notes, "/sourceClip/mediaType", clip.mediaType);
  clip.mediaType = INSTRUCT_CLIP_MEDIA;
  if ("durationSec" in clip && clip.durationSec !== INSTRUCT_CLIP_SEC) note(notes, "/sourceClip/durationSec", clip.durationSec);
  clip.durationSec = INSTRUCT_CLIP_SEC;
  if (sentPlaceholder !== undefined && sentPlaceholder !== true) note(notes, "/sourceClip/stillPlaceholder", sentPlaceholder);
  clip.stillPlaceholder = true;
  if (typeof clip.localUri === "string" && /https?:\/\/|instagram\.com/i.test(clip.localUri)) {
    note(notes, "/sourceClip/localUri", clip.localUri);
    delete clip.localUri;
  }
  record.sourceClip = clip;

  const generation = asRecord(record.generation) ?? {};
  keep(generation, GENERATION_KEYS, "/generation", notes);
  enumField(generation, "mode", MODE, "/generation", notes, "muse_spark_live");
  if (typeof generation.modelId === "string" && /muse-image/i.test(generation.modelId)) {
    note(notes, "/generation/modelId", generation.modelId);
    generation.modelId = "muse-spark-1.3";
  }
  if (!generation.modelId) generation.modelId = "muse-spark-1.3";
  const calls = Array.isArray(generation.toolCalls) ? generation.toolCalls : null;
  if (generation.toolCalls !== undefined && !calls) note(notes, "/generation/toolCalls", generation.toolCalls);
  (calls ?? []).forEach((call, callIndex) => {
    const row = asRecord(call);
    const tool = row?.tool;
    if (tool !== "muse_spark") note(notes, `/generation/toolCalls/${callIndex}/tool`, tool);
    if (row && "inputKind" in row && row.inputKind !== "image") {
      note(notes, `/generation/toolCalls/${callIndex}/inputKind`, row.inputKind);
    }
  });
  generation.toolCalls = [serverToolCall()];
  record.generation = generation;

  const hints = asRecord(record.runtimeHints);
  if (record.runtimeHints !== undefined && !hints) {
    note(notes, "/runtimeHints", record.runtimeHints);
    delete record.runtimeHints;
  } else if (hints) {
    keep(hints, HINT_KEYS, "/runtimeHints", notes);
    enumField(hints, "preferredLiveMode", LIVE_MODE, "/runtimeHints", notes);
    const maxObjects = hints.maxObjectsPerStep;
    if ("maxObjectsPerStep" in hints && (typeof maxObjects !== "number" || !Number.isInteger(maxObjects) || maxObjects < 2 || maxObjects > 4)) {
      note(notes, "/runtimeHints/maxObjectsPerStep", maxObjects);
      delete hints.maxObjectsPerStep;
    }
    record.runtimeHints = hints;
  }

  const incoming = Array.isArray(record.steps) ? record.steps : [];
  const prepared = incoming.map((step, index) => prepareStep(step, index, notes)).filter((step): step is Record<string, unknown> => !!step);
  if (prepared.length < incoming.length) {
    note(notes, "/steps", `${incoming.length - prepared.length} step(s) dropped`);
  }
  const steps = prepared.slice(0, 4);
  if (prepared.length > 4) note(notes, "/steps", prepared.slice(4));
  const slice = INSTRUCT_CLIP_SEC / Math.max(steps.length, 1);
  const seenIds = new Set<string>();
  steps.forEach((item, index) => {
    const path = `/steps/${index}`;
    if ("index" in item && item.index !== index) note(notes, `${path}/index`, item.index);
    item.index = index;
    let id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `step_${index + 1}`;
    if (seenIds.has(id)) id = `${id}_${index + 1}`;
    seenIds.add(id);
    item.id = id;
    const previous = asRecord(item.sourceTimeRange);
    const startSec = Number((index * slice).toFixed(2));
    const endSec = index === steps.length - 1 ? INSTRUCT_CLIP_SEC : Number(((index + 1) * slice).toFixed(2));
    if (previous) note(notes, `${path}/sourceTimeRange`, previous);
    item.sourceTimeRange = { startSec, endSec: endSec > startSec ? endSec : Number((startSec + 0.01).toFixed(2)) };
    alignCheckIds(item, path, notes);
  });
  record.steps = steps;
  return { value: copy, coercions: notes };
}

function prepareStep(step: unknown, index: number, notes: InstructCoercion[]): Record<string, unknown> | null {
  const item = asRecord(step);
  if (!item) return null;
  const path = `/steps/${index}`;
  const textAlias = item.instructionText ?? item.text ?? item.instruction;
  keep(item, STEP_KEYS, path, notes);
  if (typeof item.instructionText !== "string" || !item.instructionText.trim()) {
    item.instructionText = typeof textAlias === "string" && textAlias.trim() ? textAlias.trim() : `Step ${index + 1}`;
  }
  if (item.generation !== undefined) {
    const gen = asRecord(item.generation);
    const stepCalls = Array.isArray(gen?.toolCalls) ? gen.toolCalls : [];
    if (stepCalls.length) {
      stepCalls.forEach((call, callIndex) => {
        const tool = asRecord(call)?.tool;
        if (tool !== "muse_spark") note(notes, `${path}/generation/toolCalls/${callIndex}/tool`, tool);
      });
    } else note(notes, `${path}/generation`, item.generation);
    delete item.generation;
  }
  const objects = Array.isArray(item.objects) ? item.objects : [];
  const seenObjects = new Set<string>();
  item.objects = objects.map((object, objectIndex) => prepareObject(object, path, objectIndex, notes)).filter((object): object is Record<string, unknown> => !!object).slice(0, 4);
  for (const object of item.objects as Record<string, unknown>[]) {
    let id = String(object.objectId ?? "");
    if (!id || seenObjects.has(id)) {
      let n = seenObjects.size + 1;
      while (seenObjects.has(`obj_${n}`)) n += 1;
      id = `obj_${n}`;
    }
    seenObjects.add(id);
    object.objectId = id;
  }
  if ((item.objects as unknown[]).length === 0) return null;
  const check = asRecord(item.successCheck);
  if (!check) {
    if (item.successCheck !== undefined) note(notes, `${path}/successCheck`, item.successCheck);
    item.successCheck = {
      kind: "all_required_present",
      description: item.instructionText,
    };
  } else {
    keep(check, CHECK_KEYS, `${path}/successCheck`, notes);
    enumField(check, "kind", KIND, `${path}/successCheck`, notes, "all_required_present");
    if (check.kind === "ordered_presence" && !Array.isArray(check.orderObjectIds)) {
      note(notes, `${path}/successCheck/kind`, check.kind);
      check.kind = "all_required_present";
    }
    if (typeof check.description !== "string" || !check.description.trim()) check.description = item.instructionText;
    item.successCheck = check;
  }
  return item;
}

function prepareObject(object: unknown, path: string, objectIndex: number, notes: InstructCoercion[]): Record<string, unknown> | null {
  if (typeof object === "string") {
    const noun = object.trim();
    if (!noun) return null;
    note(notes, `${path}/objects/${objectIndex}`, object);
    return {
      objectId: `obj_${objectIndex + 1}`,
      noun,
      role: "required_present",
      samPrompt: noun,
    };
  }
  const row = asRecord(object);
  if (!row) return null;
  const alias = row.noun ?? row.name ?? row.text ?? row.label;
  keep(row, OBJECT_KEYS, `${path}/objects/${objectIndex}`, notes);
  enumField(row, "role", ROLE, `${path}/objects/${objectIndex}`, notes, "required_present");
  if (typeof row.noun !== "string" || !row.noun.trim()) {
    if (typeof alias === "string" && alias.trim()) row.noun = alias.trim();
  }
  if (typeof row.noun !== "string" || !row.noun.trim()) return null;
  if (typeof row.samPrompt !== "string" || !row.samPrompt.trim()) row.samPrompt = row.noun;
  if (typeof row.objectId !== "string" || !row.objectId.trim()) row.objectId = `obj_${objectIndex + 1}`;
  if ("expectedTrack" in row && typeof row.expectedTrack !== "boolean") {
    note(notes, `${path}/objects/${objectIndex}/expectedTrack`, row.expectedTrack);
    delete row.expectedTrack;
  }
  return row;
}

function alignCheckIds(item: Record<string, unknown>, path: string, notes: InstructCoercion[]) {
  const check = asRecord(item.successCheck);
  const objects = Array.isArray(item.objects) ? item.objects : [];
  if (!check) return;
  const ids = objects.map((object) => String(asRecord(object)?.objectId ?? ""));
  const known = new Set(ids);
  for (const key of ["requiredObjectIds", "forbiddenObjectIds", "orderObjectIds"] as const) {
    const listed = check[key];
    if (!Array.isArray(listed)) continue;
    if (listed.every((id) => typeof id === "string" && known.has(id))) continue;
    note(notes, `${path}/successCheck/${key}`, listed);
    delete check[key];
  }
  if (check.kind === "ordered_presence" && !Array.isArray(check.orderObjectIds)) check.kind = "all_required_present";
}
