import { normalizeSparkPayload, type NormalizeInput } from "./normalize";
import { validateTutorialSteps } from "./validate";
import type { Licence, TutorialSteps, ValidationResult } from "./types";

export type LicenceChoice = "self_filmed" | "permission_granted";

export interface UserAttribution {
  creatorName: string;
  licence: LicenceChoice;
  creditLink?: string;
}

export function licenceLabel(licence: string): string {
  if (licence === "self_filmed_sample" || licence === "self_filmed") return "self-filmed";
  if (licence === "written_permission" || licence === "permission_granted") return "permission granted";
  return "cleared";
}

export function formatCredit(attribution: { creatorName: string; licence: string; creditLine?: string }): string {
  const link = attribution.creditLine?.match(/https?:\/\/\S+/)?.[0];
  const line = `Credit · ${attribution.creatorName} · ${licenceLabel(attribution.licence)}`;
  return link ? `${line} · ${link}` : line;
}

export function creditLineFromUser(meta: UserAttribution): string {
  const name = meta.creatorName.trim();
  const link = meta.creditLink?.trim();
  const kind = meta.licence === "self_filmed" ? "self-filmed" : "permission granted";
  return link ? `${name} · ${kind} · ${link}` : `${name} · ${kind}`;
}

function schemaLicence(choice: LicenceChoice): Licence {
  return choice === "self_filmed" ? "self_filmed_sample" : "written_permission";
}

/** Replace whatever the model wrote for rights fields. */
export function applyUserAttribution(tutorial: TutorialSteps, meta: UserAttribution): TutorialSteps {
  const creatorName = meta.creatorName.trim();
  const creditLine = creditLineFromUser(meta);
  const licence = schemaLicence(meta.licence);
  const sampleLabel = meta.licence === "self_filmed";
  const next = structuredClone(tutorial);
  next.sampleLabel = sampleLabel;
  next.attribution = { creatorName, creditLine, licence };
  for (const step of next.steps) {
    step.credit = { creditLine, creatorName, sampleLabel };
  }
  return next;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function tutorialFromSparkPayload(
  payload: unknown,
  meta: UserAttribution,
  hints: NormalizeInput = {},
): ValidationResult {
  const copy = structuredClone(payload);
  const record = asRecord(copy);
  if (record) {
    delete record.attribution;
    delete record.sampleLabel;
    if (Array.isArray(record.steps)) {
      for (const step of record.steps) {
        const item = asRecord(step);
        if (item) delete item.credit;
      }
    }
  }
  if (record && typeof record.schemaVersion === "string" && Array.isArray(record.steps)) {
    record.sampleLabel = false;
    record.attribution = { creatorName: "pending", creditLine: "pending", licence: "other_cleared" };
    for (const step of record.steps) {
      const item = asRecord(step);
      if (item) item.credit = { creditLine: "pending" };
    }
    const validated = validateTutorialSteps(record);
    if (!validated.ok) return validated;
    return validateTutorialSteps(applyUserAttribution(validated.value, meta));
  }
  const normalized = normalizeSparkPayload(copy, { ...hints, creditLine: "pending" });
  if (!normalized.ok) return normalized;
  return validateTutorialSteps(applyUserAttribution(normalized.value, meta));
}
