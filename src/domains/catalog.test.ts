import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS } from "@/src/samples/demos";
import { highlightedBoxes } from "@/src/samples/boxes";
import { boxInsideCrop, CARD_SHAPE, fitDemo, FRAME_SHAPES, placementFor, requiredAspect, sampleStageSize, titlePlacementFor, usesSourceEdgeException } from "@/src/samples/frame-fit";
import { coverTransform, visibleFrameRect, type FrameBox } from "@/src/samples/mask-geometry";
import { cardCoverStep, NO_RECORDED_HIGHLIGHT, presentNouns, tutorialFromScene, unverifiedStep, unverifiedStepHint, type SampleScene } from "@/src/samples/scene";
import { missingObjectHint } from "@/src/fsm/ui";
import { PUBLISHED_SAMPLES } from "./catalog";

const DEMO_ORDER = ["masala-chai", "flask-colour", "origami", "seed-planting", "latte-art"];

/** Hit nouns, in steps.json order. The coach list must use these words. */
const HIT_NOUNS: Record<string, string[][]> = {
  "flask-colour": [
    ["flask", "bottle"],
    ["flask", "bottle"],
    ["rod", "flask"],
  ],
  origami: [
    ["paper"],
    ["heart"],
    ["crane"],
  ],
  "seed-planting": [
    ["gloves", "tray"],
    ["gloves"],
    ["jar", "gloves"],
  ],
  "latte-art": [
    ["cup"],
    ["cup"],
    ["cup"],
  ],
};

const FLASK_CHEMICAL = /chemical|chemistry|chimique|acid|alkali|vinegar|bicarbonate|sodium|peroxide|ammonia|bleach|hydroxide|phenolphthalein|litmus|reagent|hydrochloric|sulfuric|ethanol|methanol|\bph\b/i;

const UI_COPY = ["src/ui/Landing.tsx", "src/fsm/ui.ts", "src/ui/CoachScreen.tsx", "src/ui/UploadScreen.tsx", "src/ui/chrome.tsx"];

describe("published samples", () => {
  it("publishes demos only from the catalog data", () => {
    expect(DEMOS.map((demo) => demo.slug)).toEqual(DEMO_ORDER);
    expect(DEMOS.length).toBe(5);
    expect(PUBLISHED_SAMPLES).toHaveLength(DEMOS.length);
    expect(PUBLISHED_SAMPLES.map((item) => item.id)).toEqual(DEMOS.map((demo) => demo.slug));
    expect(PUBLISHED_SAMPLES.some((item) => item.id === "bike-chain")).toBe(false);
    for (const sample of PUBLISHED_SAMPLES) {
      expect(sample.stepCrops.length).toBe(sample.scene.steps.length);
      expect(sample.creatorName.length).toBeGreaterThan(0);
      expect(sample.clip.length).toBeGreaterThan(0);
      expect(sample.tutorial.sampleLabel).toBe(true);
    }
  });

  it("does not tell the user that boxes are pixel masks", () => {
    for (const file of UI_COPY) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("Keyframe masks")).toBe(false);
      expect(source.includes("isn't masked")).toBe(false);
      expect(source.includes("Not masked")).toBe(false);
      expect(source.includes("Mask lost")).toBe(false);
      expect(source.includes("Cook along")).toBe(false);
    }
    expect(readFileSync("src/ui/Landing.tsx", "utf8")).toContain("Follow along");
    expect(readFileSync("src/ui/Landing.tsx", "utf8")).toContain("Keyframe highlights");
  });

  it("does not hard-code the second-domain title in the screens", () => {
    for (const file of ["src/ui/Landing.tsx", "src/ui/UploadScreen.tsx", "src/ui/ExtractingScreen.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source.includes("Bike chain")).toBe(false);
      expect(source.includes("PUBLISHED_SAMPLES") || source.includes("sampleByPublishedId")).toBe(true);
    }
  });
});

function diskBoxes(scene: SampleScene): FrameBox[][] {
  const files: Record<string, unknown> = {};
  for (const step of scene.steps) {
    const text = readFileSync(`public/samples/${scene.demo}/${step.samFile}`, "utf8").trim();
    files[step.samFile] = text ? JSON.parse(text) as unknown : {};
  }
  return highlightedBoxes(scene, files);
}

describe("catalog frame shapes", () => {
  it("picks the narrowest cover that holds every step, and logs which step forced it", () => {
    expect(DEMOS.length).toBeGreaterThan(0);
    const unfit: string[] = [];
    for (const demo of DEMOS) {
      const boxes = diskBoxes(demo.scene);
      expect(boxes.map((step) => step.map((box) => `${box.x1},${box.y1},${box.x2},${box.y2}`))).toEqual(
        demo.boxes.map((step) => step.map((box) => `${box.x1},${box.y1},${box.x2},${box.y2}`)),
      );
      const cardStep = Math.max(0, (demo.scene.hero.samStep ?? 1) - 1);
      const fit = fitDemo(boxes, 720, 405, cardStep);
      const widest = FRAME_SHAPES[FRAME_SHAPES.length - 1];
      const forced = demo.scene.steps[fit.forcedByStep];
      const needs = boxes.map((stepBoxes, index) => `step ${index + 1} needs ${requiredAspect(stepBoxes).toFixed(3)}`);
      console.log(`${demo.slug} ${fit.shape} forced by step ${fit.forcedByStep + 1} ${forced?.title ?? ""} ${needs.join("; ")}`);
      boxes.forEach((stepBoxes, index) => {
        if (demo.slug === "origami" && index === 0 && usesSourceEdgeException(stepBoxes)) {
          console.log("origami step 1: source-edge exception");
        }
      });
      const uncovered = boxes.filter((stepBoxes) => (
        !placementFor(stepBoxes, widest.aspect, 1) && !usesSourceEdgeException(stepBoxes)
      ));
      if (uncovered.length) {
        unfit.push(`${demo.slug} does not fit ${widest.id} with a 4% margin. Do not cut objects. ${needs.join("; ")}`);
        continue;
      }
      const shape = FRAME_SHAPES.find((item) => item.id === fit.shape);
      expect(demo.shape).toBe(fit.shape);
      expect(demo.stepCrops).toEqual(fit.steps.map((step) => step.position));
      expect(demo.stepZooms).toEqual(fit.steps.map((step) => step.zoom));
      expect(demo.stepTitle).toEqual(fit.stepTitle);
      expect(demo.stepFullFrame).toEqual(fit.steps.map((step) => step.fullFrame === true));
      expect(demo.cardOutlines).toBe(fit.card.outlines);
      expect(demo.cardCrop).toEqual(fit.card.position);
      for (const [index, stepBoxes] of boxes.entries()) {
        if (fit.steps[index]?.fullFrame) {
          expect(usesSourceEdgeException(stepBoxes)).toBe(true);
          expect(demo.stepZooms[index]).toBe(1);
          expect(demo.stepCrops[index]).toEqual({ x: 0.5, y: 0.5 });
          const source = { x1: 0, y1: 0, x2: 720, y2: 405 };
          for (const box of stepBoxes) {
            expect(boxInsideCrop(box, source, 720, 405), `${demo.slug} step ${index + 1} is cut on the source frame`).toBe(true);
          }
          continue;
        }
        const placed = placementFor(stepBoxes, shape?.aspect ?? 1, demo.stepZooms[index] ?? 1);
        expect(placed, `${demo.slug} step ${index + 1} has no crop`).not.toBeNull();
        for (const box of stepBoxes) {
          expect(boxInsideCrop(box, placed!.window, 720, 405), `${demo.slug} step ${index + 1} box outside ${fit.shape}`).toBe(true);
        }
      }
      const cardAspect = FRAME_SHAPES.find((item) => item.id === CARD_SHAPE)?.aspect ?? 4 / 5;
      const cardBoxes = boxes[cardStep] ?? [];
      const card = placementFor(cardBoxes, cardAspect, demo.cardZoom);
      if (demo.cardOutlines) {
        expect(cardBoxes.length, `${demo.slug} card outlines need a verified mask`).toBeGreaterThan(0);
        expect(card, `${demo.slug} card outlines need a 4:5 crop`).not.toBeNull();
        for (const box of cardBoxes) {
          expect(boxInsideCrop(box, card!.window, 720, 405), `${demo.slug} card outline is cut`).toBe(true);
        }
      } else {
        expect(card == null || cardBoxes.length === 0).toBe(true);
      }
    }
    expect(DEMOS.find((demo) => demo.slug === "masala-chai")?.shape).toBe("5:4");
    expect(DEMOS.find((demo) => demo.slug === "seed-planting")?.shape).toBe("5:4");
    expect(unfit, unfit.join("\n")).toEqual([]);
  });

  it("keeps every Sample stage, including 390 no-camera, on the demo shape", () => {
    for (const demo of DEMOS) {
      const boxes = diskBoxes(demo.scene);
      for (const width of [390, 550]) {
        const stage = sampleStageSize(demo.shape, width);
        expect(stage.width / stage.height).toBeCloseTo(stage.aspect, 5);
        boxes.forEach((stepBoxes, index) => {
          const zoom = demo.stepZooms[index] ?? 1;
          if (demo.stepFullFrame[index]) {
            const viewW = width;
            const viewH = width * (405 / 720);
            const cover = coverTransform(720, 405, viewW, viewH, { x: 0.5, y: 0.5 }, 1);
            const window = visibleFrameRect(720, 405, viewW, viewH, cover);
            for (const box of stepBoxes) {
              expect(box.x1).toBeGreaterThanOrEqual(window.x1 - 0.6);
              expect(box.y1).toBeGreaterThanOrEqual(window.y1 - 0.6);
              expect(box.x2).toBeLessThanOrEqual(window.x2 + 0.6);
              expect(box.y2).toBeLessThanOrEqual(window.y2 + 0.6);
            }
            return;
          }
          const cover = coverTransform(720, 405, stage.width, stage.height, demo.stepCrops[index], zoom);
          const window = visibleFrameRect(720, 405, stage.width, stage.height, cover);
          for (const box of stepBoxes) {
            expect(box.x1).toBeGreaterThanOrEqual(window.x1 - 0.6);
            expect(box.y1).toBeGreaterThanOrEqual(window.y1 - 0.6);
            expect(box.x2).toBeLessThanOrEqual(window.x2 + 0.6);
            expect(box.y2).toBeLessThanOrEqual(window.y2 + 0.6);
          }
          const title = titlePlacementFor(stepBoxes, stage.width, stage.height, demo.stepCrops[index], zoom);
          expect(demo.stepTitle[index]).toBe(title);
          if (title === "overlay") {
            const band = window.y1 + (window.y2 - window.y1) * 0.72;
            expect(stepBoxes.every((box) => box.y2 <= band + 0.5)).toBe(true);
          }
        });
      }
    }
    const chai = sampleStageSize("5:4", 390);
    expect(chai.width).toBe(390);
    expect(chai.height).toBeCloseTo(312, 5);
  });

  it("keeps the step text when a recorded file has no mask", () => {
    const scene = DEMOS[0].scene;
    const files = Object.fromEntries(scene.steps.map((step) => [step.samFile, {}]));
    const boxes = highlightedBoxes(scene, files);
    expect(boxes.every((step) => step.length === 0)).toBe(true);
    const tutorial = tutorialFromScene(scene, "indian_recipe");
    boxes.forEach((stepBoxes, index) => {
      expect(stepBoxes).toEqual([]);
      expect(scene.steps[index].title.trim().length).toBeGreaterThan(0);
      expect(tutorial.steps[index].instructionText).toBe(scene.steps[index].title);
    });
    for (const demo of DEMOS) {
      const recorded = diskBoxes(demo.scene);
      const built = tutorialFromScene(demo.scene, demo.domain);
      recorded.forEach((stepBoxes, index) => {
        expect(built.steps[index].instructionText).toBe(demo.scene.steps[index].title);
        expect(demo.scene.steps[index].title.trim().length).toBeGreaterThan(0);
        if (stepBoxes.length) return;
        expect(stepBoxes).toEqual([]);
      });
    }
  });

  it("names the recorded hit objects in the step text and the in-frame list", () => {
    for (const [slug, steps] of Object.entries(HIT_NOUNS)) {
      const demo = DEMOS.find((item) => item.slug === slug);
      expect(demo, slug).toBeDefined();
      const tutorial = tutorialFromScene(demo!.scene, demo!.domain);
      const boxes = diskBoxes(demo!.scene);
      steps.forEach((nouns, index) => {
        const step = demo!.scene.steps[index];
        expect(step.nouns.filter((noun) => noun.present).map((noun) => noun.noun)).toEqual(nouns);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.instruction.trim().length).toBeGreaterThan(0);
        const listed = (step as { keepFullyInFrame?: string[] }).keepFullyInFrame ?? [];
        const drawnNames = step.nouns.filter((noun) => noun.present && noun.verified === true).map((noun) => noun.noun);
        expect(listed).toEqual(drawnNames);
        const drawable = step.nouns.filter((noun) => noun.present && noun.verified !== false);
        if (!drawable.length) {
          expect(boxes[index]).toEqual([]);
          return;
        }
        expect(boxes[index].length).toBeGreaterThan(0);
        expect(missingObjectHint(tutorial.steps[index], null)).toBe(`Keep these fully in frame: ${drawnNames.join(", ")}.`);
        expect(demo!.scene.label).toBe("Sample · recorded SAM output");
      });
    }
    const flask = DEMOS.find((demo) => demo.slug === "flask-colour");
    expect(flask?.safetyNote).toBe("Grown-up supervision");
    const visible = flask!.scene.steps.flatMap((step) => [
      step.title,
      step.instruction,
      step.hinglishPrompt ?? "",
      ...step.nouns.flatMap((noun) => [noun.noun, noun.samPrompt]),
    ]).join("\n") + (flask?.safetyNote ?? "");
    expect(visible).not.toMatch(FLASK_CHEMICAL);
    expect(visible).not.toContain("\u2014");
    expect(DEMOS.filter((demo) => demo.slug !== "flask-colour").every((demo) => !demo.safetyNote)).toBe(true);
    const latte = DEMOS.find((demo) => demo.slug === "latte-art");
    expect(latte?.scene.hero.samStep).toBe(2);
    expect(latte?.cardOutlines).toBe(true);
    expect(latte?.boxes[0]).toEqual([]);
    expect(latte?.boxes[2]).toEqual([]);
    expect(latte?.boxes[1].length).toBeGreaterThan(0);
    expect(latte?.scene.steps[0].nouns[0].verified).toBe(false);
    expect(latte?.scene.steps[2].nouns[0].verified).toBe(false);
    const origami = DEMOS.find((demo) => demo.slug === "origami");
    expect(origami?.scene.steps[0].nouns.find((noun) => noun.noun === "paper")?.maskOrdinal).toBe("6");
    expect(origami?.stepFullFrame[0]).toBe(true);
  });

  it("names only objects drawn on that step, including the title and the card", () => {
    const vocab = [...new Set(DEMOS.flatMap((demo) => demo.scene.steps.flatMap((step) => step.nouns.map((noun) => noun.noun.toLowerCase()))))]
      .sort((left, right) => right.length - left.length);
    const named = (text: string) => vocab.filter((noun) => new RegExp(`\\b${noun}s?\\b`, "i").test(text));
    const drawnOn = (step: SampleScene["steps"][number]) => new Set(
      step.nouns.filter((noun) => noun.present && noun.verified === true).map((noun) => noun.noun.toLowerCase()),
    );
    const docs = ["docs/demo-script.md", "README.md", "docs/SUBMISSION-DRAFT.md"].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(docs).not.toMatch(/both hands/i);
    expect(docs).not.toMatch(/beside the pot/i);
    expect(docs).not.toMatch(/small pot/i);
    expect(docs).not.toMatch(/move along the tray/i);
    expect(docs).not.toMatch(/\u2013|\u2014/);
    expect(DEMOS.reduce((count, demo) => count + demo.scene.steps.length, 0)).toBe(15);
    const landing = readFileSync("src/ui/Landing.tsx", "utf8");
    expect(landing).toContain("cardCoverStep(sample.scene, sample.cardOutlines)");
    expect(landing).toContain("sample.tutorial.steps[cover.index]?.successCheck.description");
    for (const demo of DEMOS) {
      const tutorial = tutorialFromScene(demo.scene, demo.domain);
      demo.scene.steps.forEach((step, index) => {
        const drawn = drawnOn(step);
        const fields: Record<string, string> = {
          title: step.title,
          body: step.instruction,
          prompt: step.hinglishPrompt ?? "",
          inFrame: ((step as { keepFullyInFrame?: string[] }).keepFullyInFrame ?? []).join(" "),
          stepList: tutorial.steps[index].instructionText,
        };
        expect(fields.stepList).toBe(step.title);
        expect(`${fields.title}\n${fields.body}\n${fields.prompt}`).not.toMatch(/\u2013|\u2014/);
        for (const [field, text] of Object.entries(fields)) {
          for (const noun of named(text)) {
            expect(drawn.has(noun), `${demo.slug} step ${index + 1} ${field} names ${noun}`).toBe(true);
          }
        }
        if (unverifiedStep(step.nouns)) {
          expect(unverifiedStepHint(step.nouns)).toBe(`Keep the ${step.nouns.find((noun) => noun.verified === false)?.noun} fully in frame`);
          return;
        }
        for (const noun of named(missingObjectHint(tutorial.steps[index], null) ?? "")) {
          expect(drawn.has(noun), `${demo.slug} step ${index + 1} hint names ${noun}`).toBe(true);
        }
      });
      const step1 = demo.scene.steps[0];
      const cover = cardCoverStep(demo.scene, demo.cardOutlines);
      const cardNouns = new Set(drawnOn(cover));
      const description = tutorial.steps[cover.index].successCheck.description;
      expect(description, demo.slug).not.toContain("No recorded highlight");
      expect(description, demo.slug).not.toContain("No highlight on this frame");
      expect(description, demo.slug).not.toBe(NO_RECORDED_HIGHLIGHT);
      for (const step of demo.scene.steps) {
        if (!unverifiedStep(step.nouns)) continue;
        expect(description, demo.slug).not.toBe(unverifiedStepHint(step.nouns));
      }
      for (const noun of named(description)) {
        expect(cardNouns.has(noun), `${demo.slug} card description names ${noun}`).toBe(true);
      }
      const chips = presentNouns(cover).filter((noun) => noun.verified !== false);
      for (const noun of chips) {
        expect(cardNouns.has(noun.noun.toLowerCase()), `${demo.slug} card chip ${noun.noun}`).toBe(true);
      }
      if (demo.slug === "latte-art") {
        expect(cover.index).toBe(1);
        expect(description).toBe(demo.scene.steps[1].instruction);
      }
      if (!demo.cardOutlines) {
        expect(cover.index).toBe(0);
      }
    }
  });
});
