import aloo from "@/src/fixtures/sample-aloo-jeera.steps.json";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
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
export const SAMPLE_CHAI = load(PUBLISHED_SAMPLES[0].tutorial, "Masala chai");

export function sampleById(id: string | undefined): TutorialSteps {
  const published = PUBLISHED_SAMPLES.find((item) => item.id === id || item.tutorial.tutorialId === id);
  if (published) return structuredClone(published.tutorial);
  if (id === "aloo-jeera" || id === SAMPLE_ALOO.tutorialId) return structuredClone(SAMPLE_ALOO);
  return structuredClone(SAMPLE_CHAI);
}

export function sampleForTranscript(transcript: string | undefined, domain?: string): TutorialSteps {
  const byDomain = PUBLISHED_SAMPLES.find((item) => item.domain === domain);
  if (byDomain) return structuredClone(byDomain.tutorial);
  const text = `${transcript ?? ""}`.toLowerCase();
  if (/aloo|jeera|onion/.test(text)) return structuredClone(SAMPLE_ALOO);
  return structuredClone(SAMPLE_CHAI);
}
