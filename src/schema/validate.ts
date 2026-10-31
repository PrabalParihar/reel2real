import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";
import schema from "./steps.schema.json";
import type { TutorialSteps, ValidationIssue, ValidationResult } from "./types";

let compiled: ValidateFunction | null = null;

function validator(): ValidateFunction {
  if (!compiled) {
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      useDefaults: true,
      validateSchema: false,
    });
    addFormats(ajv);
    compiled = ajv.compile(schema);
  }
  return compiled;
}

function issuesFromAjv(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    path: error.instancePath || "/",
    message: error.message ?? "invalid",
  }));
}

function push(errors: ValidationIssue[], path: string, message: string) {
  errors.push({ path, message });
}

function isRemote(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || /instagram\.com|instagr\.am|cdninstagram|facebook\.com\/reel/i.test(value);
}

function collectModelIds(value: unknown, ids: string[]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectModelIds(item, ids);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.modelId === "string") ids.push(record.modelId);
  for (const child of Object.values(record)) collectModelIds(child, ids);
}

function semantic(tutorial: TutorialSteps): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!tutorial.generation.modelId.trim()) {
    push(errors, "/generation/modelId", "model id is required");
  }
  const modelIds: string[] = [];
  collectModelIds(tutorial, modelIds);
  if (modelIds.some((id) => /muse-image/i.test(id))) {
    push(errors, "/generation/modelId", "Muse Image is not used");
  }
  const localUri = tutorial.sourceClip.localUri;
  if (localUri && isRemote(localUri)) {
    push(errors, "/sourceClip/localUri", "localUri must be a local placeholder or upload path");
  }
  if (
    tutorial.attribution.licence === "written_permission" &&
    tutorial.attribution.permissionDocPath &&
    isRemote(tutorial.attribution.permissionDocPath)
  ) {
    push(errors, "/attribution/permissionDocPath", "permission path must stay in the repo");
  }

  const maxObjects = tutorial.runtimeHints?.maxObjectsPerStep;
  const seenStep = new Set<string>();
  tutorial.steps.forEach((step, index) => {
    if (step.index !== index) {
      push(errors, `/steps/${index}/index`, `expected index ${index}`);
    }
    if (seenStep.has(step.id)) push(errors, `/steps/${index}/id`, "duplicate step id");
    seenStep.add(step.id);
    if (!step.credit.creditLine.trim()) {
      push(errors, `/steps/${index}/credit/creditLine`, "every step needs a credit line");
    }
    const { startSec, endSec } = step.sourceTimeRange;
    if (endSec <= startSec) {
      push(errors, `/steps/${index}/sourceTimeRange`, "endSec must be greater than startSec");
    }
    if (endSec > tutorial.sourceClip.durationSec + 0.001) {
      push(errors, `/steps/${index}/sourceTimeRange`, "time range exceeds the source clip");
    }
    if (maxObjects && step.objects.length > maxObjects) {
      push(errors, `/steps/${index}/objects`, `exceeds maxObjectsPerStep ${maxObjects}`);
    }
    const objectIds = new Set<string>();
    for (const object of step.objects) {
      if (objectIds.has(object.objectId)) {
        push(errors, `/steps/${index}/objects`, `duplicate object id ${object.objectId}`);
      }
      objectIds.add(object.objectId);
    }
    const known = (id: string) => objectIds.has(id);
    for (const id of step.successCheck.requiredObjectIds ?? []) {
      if (!known(id)) push(errors, `/steps/${index}/successCheck`, `unknown required object ${id}`);
    }
    for (const id of step.successCheck.forbiddenObjectIds ?? []) {
      if (!known(id)) push(errors, `/steps/${index}/successCheck`, `unknown forbidden object ${id}`);
    }
    if (step.successCheck.kind === "ordered_presence" && !(step.successCheck.orderObjectIds?.length)) {
      push(errors, `/steps/${index}/successCheck`, "ordered_presence needs orderObjectIds");
    }
    for (const id of step.successCheck.orderObjectIds ?? []) {
      if (!known(id)) push(errors, `/steps/${index}/successCheck`, `unknown ordered object ${id}`);
    }
    for (const id of step.safety?.triggerObjectIds ?? []) {
      if (!known(id)) push(errors, `/steps/${index}/safety`, `unknown safety object ${id}`);
    }
  });
  return errors;
}

export function validateTutorialSteps(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [{ path: "/", message: "Tutorial must be a JSON object" }] };
  }
  const copy = structuredClone(input);
  const valid = validator()(copy);
  const schemaErrors = valid ? [] : issuesFromAjv(validator().errors);
  if (schemaErrors.length) return { ok: false, errors: schemaErrors };
  const value = copy as TutorialSteps;
  const extra = semantic(value);
  if (extra.length) return { ok: false, errors: extra };
  return { ok: true, value };
}
