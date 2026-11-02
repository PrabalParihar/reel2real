import type { TutorialStep } from "@/src/schema/types";

export interface ObjectEvidence {
  presence: Record<string, boolean> | null;
  unavailable?: boolean;
  expired?: boolean;
}

export interface ObjectEvidenceRow {
  objectId: string;
  noun: string;
  status: "Not checked" | "Visible in checked frame" | "Not highlighted" | "Check unavailable" | "Check expired";
}

export function objectEvidenceRows(step: TutorialStep, evidence: ObjectEvidence): ObjectEvidenceRow[] {
  const required = step.successCheck.requiredObjectIds?.length
    ? step.successCheck.requiredObjectIds
    : step.objects.filter((object) => object.role === "required_present").map((object) => object.objectId);
  return [...new Set(required)].map((objectId) => {
    const noun = (step.objects.find((object) => object.objectId === objectId)?.noun ?? objectId).replaceAll("_", " ");
    const value = evidence.presence && Object.hasOwn(evidence.presence, objectId) ? evidence.presence[objectId] : undefined;
    const status = evidence.expired ? "Check expired"
      : evidence.unavailable ? "Check unavailable"
        : value === true ? "Visible in checked frame"
          : value === false ? "Not highlighted"
            : "Not checked";
    return { objectId, noun, status };
  });
}
