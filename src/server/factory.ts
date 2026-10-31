import { DEFAULT_LIVE_MODE } from "@/src/models";
import { readModelApiKey } from "./env";
import { createLiveSegmentationClient, createLiveSparkClient } from "./live";
import { createMockSegmentationClient, createMockSparkClient } from "./mock";
import type { ModelClients } from "./types";

export function createModelClients(
  env: Record<string, string | undefined>,
  options?: { mockSparkDelayMs?: number },
): ModelClients {
  const key = readModelApiKey(env);
  if (!key) {
    return {
      mode: "mock",
      spark: createMockSparkClient({ delayMs: options?.mockSparkDelayMs ?? 0 }),
      segmentation: createMockSegmentationClient(),
      liveModeDefault: DEFAULT_LIVE_MODE,
    };
  }
  return {
    mode: "live",
    spark: createLiveSparkClient(key),
    segmentation: createLiveSegmentationClient(key),
    liveModeDefault: DEFAULT_LIVE_MODE,
  };
}
