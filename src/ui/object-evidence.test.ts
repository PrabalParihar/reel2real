import { describe, expect, it } from "vitest";
import type { TutorialStep } from "@/src/schema/types";
import { objectEvidenceRows } from "./object-evidence";

const step: TutorialStep = {
  id: "pour", index: 1, instructionText: "Pour into the flask",
  sourceTimeRange: { startSec: 0, endSec: 2 }, credit: { creditLine: "Fixture" },
  objects: [
    { objectId: "flask", noun: "glass_flask", role: "required_present", samPrompt: "flask" },
    { objectId: "bottle", noun: "bottle", role: "required_present", samPrompt: "bottle" },
    { objectId: "spoon", noun: "spoon", role: "optional", samPrompt: "spoon" },
  ],
  successCheck: { kind: "all_required_present", description: "Objects visible", requiredObjectIds: ["flask", "bottle", "flask"] },
};

describe("current-step object evidence", () => {
  it("deduplicates explicit required IDs and excludes optional and future evidence", () => {
    expect(objectEvidenceRows(step, { presence: { flask: true, bottle: false, spoon: true, later: true } })).toEqual([
      { objectId: "flask", noun: "glass flask", status: "Visible in checked frame" },
      { objectId: "bottle", noun: "bottle", status: "Not highlighted" },
    ]);
    expect(objectEvidenceRows({ ...step, successCheck: { ...step.successCheck, requiredObjectIds: ["bottle"] } }, { presence: null })).toEqual([
      { objectId: "bottle", noun: "bottle", status: "Not checked" },
    ]);
  });

  it.each([undefined, []])("falls back to required-present roles when required IDs are %s", (requiredObjectIds) => {
    const rows = objectEvidenceRows({ ...step, successCheck: { ...step.successCheck, requiredObjectIds } }, { presence: null });
    expect(rows.map((row) => row.objectId)).toEqual(["flask", "bottle"]);
  });

  it("keeps omitted IDs unknown, including keys inherited from the object prototype", () => {
    expect(objectEvidenceRows(step, { presence: { flask: false } }).map((row) => row.status)).toEqual(["Not highlighted", "Not checked"]);
    expect(objectEvidenceRows(step, { presence: Object.create({ flask: true }) }).map((row) => row.status)).toEqual(["Not checked", "Not checked"]);
  });

  it.each([null, { flask: true, bottle: false }])("never treats failed evidence as an observed presence or absence", (presence) => {
    expect(objectEvidenceRows(step, { presence, unavailable: true }).map((row) => row.status)).toEqual(["Check unavailable", "Check unavailable"]);
  });

  it("marks expired evidence even if a previous result or generic failure flag survives", () => {
    expect(objectEvidenceRows(step, { presence: { flask: true, bottle: false }, unavailable: true, expired: true }).map((row) => row.status)).toEqual(["Check expired", "Check expired"]);
  });

  it("returns to unknown after the lifecycle clears evidence, and selects only the new step", () => {
    const nextStep = { ...step, objects: [{ objectId: "paper", noun: "paper", role: "required_present" as const, samPrompt: "paper" }], successCheck: { ...step.successCheck, requiredObjectIds: ["paper"] } };
    expect(objectEvidenceRows(step, { presence: null }).map((row) => row.status)).toEqual(["Not checked", "Not checked"]);
    expect(objectEvidenceRows(nextStep, { presence: { flask: true } })).toEqual([{ objectId: "paper", noun: "paper", status: "Not checked" }]);
  });
});
