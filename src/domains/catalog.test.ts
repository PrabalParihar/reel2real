import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMOS } from "@/src/samples/demos";
import { highlightedBoxes } from "@/src/samples/boxes";
import { boxInsideCrop, CARD_SHAPE, fitDemo, FRAME_SHAPES, placementFor, sampleStageSize, titlePlacementFor } from "@/src/samples/frame-fit";
import { coverTransform, visibleFrameRect, type FrameBox } from "@/src/samples/mask-geometry";
import { tutorialFromScene, type SampleScene } from "@/src/samples/scene";
import { PUBLISHED_SAMPLES } from "./catalog";

const UI_COPY = ["src/ui/Landing.tsx", "src/fsm/ui.ts", "src/ui/CoachScreen.tsx", "src/ui/UploadScreen.tsx", "src/ui/chrome.tsx"];

describe("published samples", () => {
  it("publishes demos only from the catalog data", () => {
    expect(DEMOS.length).toBeGreaterThanOrEqual(1);
    expect(DEMOS.length).toBeLessThanOrEqual(5);
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
    for (const demo of DEMOS) {
      const boxes = diskBoxes(demo.scene);
      expect(boxes.map((step) => step.map((box) => `${box.x1},${box.y1},${box.x2},${box.y2}`))).toEqual(
        demo.boxes.map((step) => step.map((box) => `${box.x1},${box.y1},${box.x2},${box.y2}`)),
      );
      const fit = fitDemo(boxes);
      const widest = FRAME_SHAPES[FRAME_SHAPES.length - 1];
      const fitsWidest = boxes.every((stepBoxes) => placementFor(stepBoxes, widest.aspect, 1));
      if (!fitsWidest) {
        const needs = boxes.map((stepBoxes, index) => `step ${index + 1} needs aspect ${fitDemo([stepBoxes]).aspect.toFixed(3)}`);
        throw new Error(`${demo.slug} does not fit ${widest.id} with a 4% margin. Do not cut objects. ${needs.join("; ")}`);
      }
      const forced = demo.scene.steps[fit.forcedByStep];
      const shape = FRAME_SHAPES.find((item) => item.id === fit.shape);
      console.log(`${demo.slug} ${fit.shape} forced by step ${fit.forcedByStep + 1} ${forced?.title ?? ""}`);
      expect(demo.shape).toBe(fit.shape);
      expect(demo.stepCrops).toEqual(fit.steps.map((step) => step.position));
      expect(demo.stepZooms).toEqual(fit.steps.map((step) => step.zoom));
      expect(demo.stepTitle).toEqual(fit.stepTitle);
      expect(demo.cardOutlines).toBe(fit.card.outlines);
      expect(demo.cardCrop).toEqual(fit.card.position);
      for (const [index, stepBoxes] of boxes.entries()) {
        const placed = placementFor(stepBoxes, shape?.aspect ?? 1, demo.stepZooms[index] ?? 1);
        expect(placed, `${demo.slug} step ${index + 1} has no crop`).not.toBeNull();
        for (const box of stepBoxes) {
          expect(boxInsideCrop(box, placed!.window, 720, 405), `${demo.slug} step ${index + 1} box outside ${fit.shape}`).toBe(true);
        }
      }
      const cardAspect = FRAME_SHAPES.find((item) => item.id === CARD_SHAPE)?.aspect ?? 4 / 5;
      const card = placementFor(boxes[0] ?? [], cardAspect, demo.cardZoom);
      if (demo.cardOutlines) {
        expect(card, `${demo.slug} card outlines need a 4:5 crop`).not.toBeNull();
        for (const box of boxes[0] ?? []) {
          expect(boxInsideCrop(box, card!.window, 720, 405), `${demo.slug} card outline is cut`).toBe(true);
        }
      } else {
        expect(card).toBeNull();
      }
    }
    expect(DEMOS.find((demo) => demo.slug === "masala-chai")?.shape).toBe("5:4");
  });

  it("keeps every Sample stage, including 390 no-camera, on the demo shape", () => {
    for (const demo of DEMOS) {
      const boxes = diskBoxes(demo.scene);
      for (const width of [390, 550]) {
        const stage = sampleStageSize(demo.shape, width);
        expect(stage.width / stage.height).toBeCloseTo(stage.aspect, 5);
        boxes.forEach((stepBoxes, index) => {
          const zoom = demo.stepZooms[index] ?? 1;
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
        if (stepBoxes.length) return;
        expect(built.steps[index].instructionText).toBe(demo.scene.steps[index].title);
        expect(stepBoxes).toEqual([]);
      });
    }
  });
});
