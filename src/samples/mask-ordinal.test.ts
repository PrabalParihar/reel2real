import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { missingObjectHint } from "@/src/fsm/ui";
import { RecordedOutlineLayer } from "@/src/ui/PhotoFrame";
import { DEMOS } from "./demos";
import {
  selectMaskRecord,
  tutorialFromScene,
  unverifiedStep,
  type SamStepFile,
  type SceneNoun,
} from "./scene";

function scene(slug: string) {
  const demo = DEMOS.find((item) => item.slug === slug);
  if (!demo) throw new Error(slug);
  return demo;
}

function loadSam(slug: string, file: string): SamStepFile {
  return JSON.parse(readFileSync(`public/samples/${slug}/${file}`, "utf8")) as SamStepFile;
}

function drawn(slug: string, index: number) {
  const step = scene(slug).scene.steps[index];
  const file = loadSam(slug, step.samFile);
  return step.nouns
    .filter((noun) => noun.noun === "gloves" || noun.noun === "hand")
    .map((noun) => ({
      objectId: noun.objectId,
      ordinal: noun.maskOrdinal ?? null,
      verified: noun.verified === true,
      selected: selectMaskRecord(file.calls, noun)?.record.ordinal ?? null,
    }));
}

describe("explicit mask ordinals", () => {
  it("draws both gloves on seed step 1, ordinals 0 and 1", () => {
    const step = scene("seed-planting").scene.steps[0];
    const file = loadSam("seed-planting", step.samFile);
    const gloves = step.nouns.filter((noun) => noun.noun === "gloves");
    expect(gloves.map((noun) => noun.objectId)).toEqual(["obj_gloves", "obj_gloves_1"]);
    expect(gloves.map((noun) => noun.maskOrdinal)).toEqual(["0", "1"]);
    expect(gloves.every((noun) => noun.verified === true)).toBe(true);
    expect(new Set(gloves.map((noun) => noun.requestId)).size).toBe(1);
    expect(gloves[0].requestId).toBe(file.calls?.find((call) => call.noun === "gloves")?.requestId);
    const selected = gloves.map((noun) => selectMaskRecord(file.calls, noun));
    expect(selected.map((item) => String(item?.record.ordinal))).toEqual(["0", "1"]);
    expect(new Set(selected.map((item) => item?.box.x1)).size).toBe(2);
    expect(unverifiedStep(step.nouns)).toBe(false);
  });

  it("draws chai hand ordinal 0 and skips the unverified second hand", () => {
    const step = scene("masala-chai").scene.steps[1];
    const hands = drawn("masala-chai", 1);
    expect(hands).toEqual([
      { objectId: "obj_hand", ordinal: "0", verified: true, selected: "0" },
      { objectId: "obj_hand_1", ordinal: "1", verified: false, selected: null },
    ]);
    expect(unverifiedStep(step.nouns)).toBe(false);
    const tutorial = tutorialFromScene(scene("masala-chai").scene, "indian_recipe");
    expect(missingObjectHint(tutorial.steps[1], null)).toBe("Keep these fully in frame: hand.");
  });

  it("matches maskOrdinal as a string against a numeric record ordinal", () => {
    const noun: SceneNoun = {
      objectId: "obj_gloves",
      noun: "gloves",
      samPrompt: "gloves",
      color: "#E88C30",
      present: true,
      verified: true,
      requestId: "req-gloves",
      maskOrdinal: "0",
    };
    const calls = [{
      requestId: "req-gloves",
      noun: "gloves",
      present: true,
      records: [
        {
          ordinal: 0,
          box: { x1: 1, y1: 2, x2: 5, y2: 8, frameW: 20, frameH: 20 },
          maskPayload: { encoding: "one_bit" as const, width: 2, height: 2, payload: "aa" },
        },
        {
          ordinal: 1,
          box: { x1: 9, y1: 2, x2: 14, y2: 8, frameW: 20, frameH: 20 },
          maskPayload: { encoding: "one_bit" as const, width: 2, height: 2, payload: "bb" },
        },
      ],
    }];
    expect(selectMaskRecord(calls, noun)?.box.x1).toBe(1);
    expect(String(selectMaskRecord(calls, { ...noun, objectId: "obj_gloves_1", maskOrdinal: "1" })?.record.ordinal)).toBe("1");
    expect(selectMaskRecord(calls, { ...noun, maskOrdinal: "2" })).toBeNull();
  });

  it("renders two outlines when two entries share a noun", () => {
    const box = { x1: 0, y1: 0, x2: 8, y2: 8 };
    const html = renderToStaticMarkup(createElement(RecordedOutlineLayer, {
      glowId: "glow",
      stillScale: 1,
      clipRect: null,
      items: [
        { key: "obj_gloves", noun: "gloves", color: "#E88C30", draw: { d: "M0 0 L8 8", centroid: null }, frameW: 8, frameH: 8, box },
        { key: "obj_gloves_1", noun: "gloves", color: "#2DB4AA", draw: { d: "M10 0 L18 8", centroid: null }, frameW: 8, frameH: 8, box: { x1: 10, y1: 0, x2: 18, y2: 8 } },
      ],
    }));
    expect(html.match(/data-noun="gloves"/g)).toHaveLength(2);
    expect(html).toContain('data-object-id="obj_gloves"');
    expect(html).toContain('data-object-id="obj_gloves_1"');
    expect(html.match(/<path /g)?.length).toBe(6);
  });

  it("lists gloves once in the seed step 1 hint", () => {
    const demo = scene("seed-planting");
    const tutorial = tutorialFromScene(demo.scene, demo.domain);
    for (const index of [0, 1, 2]) {
      const hint = missingObjectHint(tutorial.steps[index], null) ?? "";
      expect(hint.match(/gloves/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
    expect(missingObjectHint(tutorial.steps[0], null)).toBe("Keep these fully in frame: gloves, tray.");
    expect(unverifiedStep(demo.scene.steps[2].nouns)).toBe(false);
  });

  it("leaves the flask sample nouns unchanged", () => {
    const flask = scene("flask-colour").scene;
    expect(flask.steps.map((step) => step.nouns.map((noun) => `${noun.objectId}:${noun.maskOrdinal ?? ""}:${noun.verified}`))).toEqual([
      ["obj_flask::true", "obj_bottle:2:true"],
      ["obj_flask::true", "obj_bottle:3:true"],
      ["obj_rod::false", "obj_flask::true"],
    ]);
  });
});
