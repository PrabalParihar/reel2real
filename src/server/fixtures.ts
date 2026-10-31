import aloo from "@/src/fixtures/sample-aloo-jeera.steps.json";
import chai from "@/src/fixtures/sample-masala-chai.steps.json";
import bike from "@/src/fixtures/sample-bike-chain.steps.json";
import { PUBLISHED_SAMPLES, SECOND_DOMAIN } from "@/src/domains/catalog";
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
export const SAMPLE_BIKE = load(bike, "Second domain");

export function sampleById(id: string | undefined): TutorialSteps {
  const published = PUBLISHED_SAMPLES.find((item) => item.id === id || item.tutorial.tutorialId === id);
  if (published?.id === SECOND_DOMAIN.id) return structuredClone(SAMPLE_BIKE);
  if (published) return structuredClone(SAMPLE_CHAI);
  if (id === "aloo-jeera" || id === SAMPLE_ALOO.tutorialId) return structuredClone(SAMPLE_ALOO);
  return structuredClone(SAMPLE_CHAI);
}

export function sampleForTranscript(transcript: string | undefined, domain?: string): TutorialSteps {
  if (domain === SECOND_DOMAIN.domain) return structuredClone(SAMPLE_BIKE);
  const text = `${transcript ?? ""}`.toLowerCase();
  if (/aloo|jeera|onion/.test(text)) return structuredClone(SAMPLE_ALOO);
  return structuredClone(SAMPLE_CHAI);
}
