import type { TutorialStep } from "@/src/schema/types";
import { TIMEOUTS, type Signal } from "./types";

export interface EvalCounters {
  stableHits: number;
  skipDwell: number;
  oooDwell: number;
  maskMisses: Record<string, number>;
  lockedObjectIds: string[];
}

export interface EvalInput {
  step: TutorialStep;
  laterObjectIds: string[];
  presence: Record<string, boolean>;
  counters: EvalCounters;
}

export interface EvalResult {
  signal: Signal | null;
  counters: EvalCounters;
  missingObjectIds: string[];
}

function requiredIds(step: TutorialStep): string[] {
  if (step.successCheck.requiredObjectIds?.length) return step.successCheck.requiredObjectIds;
  return step.objects.filter((object) => object.role === "required_present").map((object) => object.objectId);
}

export function evaluateCheck(input: EvalInput): EvalResult {
  const { step, presence } = input;
  const required = requiredIds(step);
  const requiredSet = new Set(required);
  const missingObjectIds = required.filter((id) => !presence[id]);
  const forbidden = step.successCheck.forbiddenObjectIds ?? [];
  const forbiddenOk = forbidden.every((id) => !presence[id]);
  let orderOk = true;
  if (step.successCheck.kind === "ordered_presence") {
    const order = step.successCheck.orderObjectIds ?? [];
    let gap = false;
    for (const id of order) {
      if (!presence[id]) gap = true;
      else if (gap) orderOk = false;
    }
    if (!order.every((id) => presence[id])) orderOk = false;
  }
  const manual = step.successCheck.kind === "manual_confirm_only";
  const complete = !manual && missingObjectIds.length === 0 && forbiddenOk && orderOk;

  const counters: EvalCounters = {
    stableHits: input.counters.stableHits,
    skipDwell: input.counters.skipDwell,
    oooDwell: input.counters.oooDwell,
    maskMisses: { ...input.counters.maskMisses },
    lockedObjectIds: [...input.counters.lockedObjectIds],
  };
  const locked = new Set(counters.lockedObjectIds);

  if (complete) {
    counters.stableHits += 1;
    counters.skipDwell = 0;
    counters.oooDwell = 0;
    for (const id of required) {
      locked.add(id);
      counters.maskMisses[id] = 0;
    }
  } else {
    counters.stableHits = 0;
    counters.skipDwell = missingObjectIds.length ? counters.skipDwell + 1 : 0;
  }

  for (const id of required) {
    if (presence[id]) locked.add(id);
  }
  for (const id of locked) {
    if (presence[id]) counters.maskMisses[id] = 0;
    else counters.maskMisses[id] = (counters.maskMisses[id] ?? 0) + 1;
  }
  counters.lockedObjectIds = [...locked];

  const unexpected = input.laterObjectIds.filter((id) => presence[id] && !requiredSet.has(id));
  if (unexpected.length && missingObjectIds.length) counters.oooDwell += 1;
  else counters.oooDwell = 0;

  const safetyIds = [
    ...(step.safety?.triggerObjectIds ?? []),
    ...step.objects.filter((object) => object.role === "safety_prop").map((object) => object.objectId),
  ];
  const safetyHit = [...new Set(safetyIds)].filter((id) => presence[id] && !requiredSet.has(id));

  const lost = counters.lockedObjectIds.filter((id) => (counters.maskMisses[id] ?? 0) >= TIMEOUTS.MASK_LOST_CHUNKS);
  const minStable = step.successCheck.minStableChunks ?? 1;

  let signal: Signal | null = null;
  if (safetyHit.length) {
    signal = {
      type: "SAFETY_SIGNAL",
      ruleId: step.safety?.ruleId ?? "safety",
      message: step.safety?.message ?? "Safety check. Clear the prop and retry.",
    };
  } else if (unexpected.length && counters.oooDwell >= TIMEOUTS.OOO_CONFIRM_CHUNKS) {
    signal = { type: "OUT_OF_ORDER_SIGNAL", unexpectedObjectIds: unexpected };
  } else if (missingObjectIds.length && counters.skipDwell >= TIMEOUTS.SKIP_DWELL_CHUNKS) {
    signal = { type: "SKIP_SIGNAL", missingObjectIds };
  } else if (lost.length) {
    signal = { type: "MASK_LOST_SIGNAL", objectIds: lost };
  } else if (complete && counters.stableHits >= minStable) {
    signal = { type: "SUCCESS_STABLE" };
  }

  return { signal, counters, missingObjectIds };
}
