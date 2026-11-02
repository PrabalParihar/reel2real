/** Server-only selector. Never serialize the selected value. */
export function readModelApiKey(env: Record<string, string | undefined>): string | null {
  return env.META_MODEL_API_KEY?.trim() || env.MODEL_API_KEY?.trim() || null;
}
