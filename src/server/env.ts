import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";

export function readModelApiKey(env: Record<string, string | undefined>): string | null {
  const primary = env.META_MODEL_API_KEY?.trim();
  if (primary) return primary;
  const alternate = env.MODEL_API_KEY?.trim();
  if (alternate) return alternate;
  return null;
}

export function publicRuntime(env: Record<string, string | undefined>) {
  return {
    mock: !readModelApiKey(env),
    sparkModelId: SPARK_MODEL_ID,
    samModelId: SAM_MODEL_ID,
  };
}
