import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { modelExecutionMode } from "./model-execution";
export { readModelApiKey } from "./model-key";

export function publicRuntime(env: Record<string, string | undefined>) {
  const execution = {
    spark: modelExecutionMode(env, "spark"),
    instruct: modelExecutionMode(env, "instruct"),
    segment: modelExecutionMode(env, "segment"),
  };
  return {
    mock: Object.values(execution).every((mode) => mode === "off"),
    sparkModelId: SPARK_MODEL_ID,
    samModelId: SAM_MODEL_ID,
    capabilities: {
      spark: execution.spark !== "off",
      instruct: execution.instruct !== "off",
      segment: execution.segment !== "off",
    },
    execution,
  };
}
