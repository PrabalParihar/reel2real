import aloo from "@/src/fixtures/sample-aloo-jeera.steps.json";
import chai from "@/src/fixtures/sample-masala-chai.steps.json";
import bike from "@/src/fixtures/sample-bike-chain.steps.json";
import { validateTutorialSteps } from "@/src/schema/validate";
import type { TutorialSteps } from "@/src/schema/types";

function load(value: unknown, name: string): TutorialSteps {
  const result = validateTutorialSteps(value);
  if (!result.ok) {
    throw new Error(`${name} fixture is invalid: ${result.errors.map((error) => error.message).join("; ")}`);
  }
  return result.value;
}

export const SAMPLE_ALOO = load(aloo, "Aloo jeera");
export const SAMPLE_CHAI = load(chai, "Masala chai");
export const SAMPLE_BIKE = load(bike, "Bike chain");

export function sampleById(id: string | undefined): TutorialSteps {
  if (id === "bike-chain" || id === SAMPLE_BIKE.tutorialId) return structuredClone(SAMPLE_BIKE);
  if (id === "aloo-jeera" || id === SAMPLE_ALOO.tutorialId) return structuredClone(SAMPLE_ALOO);
  return structuredClone(SAMPLE_CHAI);
}

export function sampleForTranscript(transcript: string | undefined, domain?: string): TutorialSteps {
  const text = `${transcript ?? ""} ${domain ?? ""}`.toLowerCase();
  if (/bike|chain|pedal|diy/.test(text) || domain === "non_cooking_diy") return structuredClone(SAMPLE_BIKE);
  if (/aloo|jeera|onion/.test(text)) return structuredClone(SAMPLE_ALOO);
  return structuredClone(SAMPLE_CHAI);
}
