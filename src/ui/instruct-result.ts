import type { TutorialSteps } from "@/src/schema/types";
import type { SparkResult } from "@/src/server/types";
import { modelRefusalReason } from "@/src/safety/goal-screen";
import { parseSparkResult } from "./sparkOnce";

export type InstructOutcome =
  | { kind: "success"; result: SparkResult & { tutorial: TutorialSteps; inputKind: "instruct" } }
  | { kind: "refusal"; reason: string }
  | { kind: "off" }
  | { kind: "error"; message: string };

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** Interpret status/refusal responses before validating a publishable plan. */
export function interpretInstructResponse(value: unknown, ok: boolean): InstructOutcome {
  const unreadable = "The service returned an unreadable plan. Try again.";
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { kind: "error", message: unreadable };
  }
  const body = value as Record<string, unknown>;
  const message = safeString(body.message);
  const errors = Array.isArray(body.errors)
    ? body.errors.filter((error): error is string => typeof error === "string" && Boolean(error.trim()))
    : [];
  const refusal = modelRefusalReason({
    refused: body.refused === true,
    reason: safeString(body.reason),
    refusalReason: safeString(body.refusalReason),
    message,
    errors,
  });
  if (refusal) return { kind: "refusal", reason: refusal };
  if (body.mode === "degraded") return { kind: "off" };
  if (!ok || safeString(body.error) || body.schemaValid !== true || !body.tutorial) {
    return { kind: "error", message: message || errors[0] || "Spark did not return a plan." };
  }
  try {
    const result = parseSparkResult(body);
    if (result.inputKind !== "instruct" || !result.schemaValid || result.tutorial === null) {
      return { kind: "error", message: unreadable };
    }
    return { kind: "success", result: { ...result, inputKind: "instruct", tutorial: result.tutorial } };
  } catch {
    return { kind: "error", message: unreadable };
  }
}
