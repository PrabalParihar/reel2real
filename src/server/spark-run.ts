import { SPARK_MODEL_ID } from "@/src/models";
import { createModelClients } from "@/src/server/factory";
import { dailyCapResponse } from "@/src/server/meta-guard";
import { screenSparkInput } from "@/src/safety/goal-screen";
import type { SparkRequest } from "@/src/server/types";

export function sparkRefusalResponse(reason: string): Response {
  return Response.json({
    refused: true,
    reason,
    refusalReason: reason,
    tutorial: null,
    schemaValid: false,
    parseOk: true,
    errors: [],
    mode: "mock",
    modelId: SPARK_MODEL_ID,
    latencyMs: 0,
    toolCalls: [],
    inputKind: "transcript",
  });
}

/** The spark call used by /api/spark and /api/internal/spark. */
export async function executeSpark(body: SparkRequest, options?: { mockSparkDelayMs?: number }): Promise<Response> {
  // Screen before the client reserves a daily call or fetches.
  const screened = screenSparkInput(body);
  if (screened) return sparkRefusalResponse(screened.reason);
  const clients = createModelClients(process.env, { mockSparkDelayMs: options?.mockSparkDelayMs ?? 0 });
  try {
    const result = await clients.spark.generateSteps({
      transcript: body.transcript,
      title: body.title,
      domain: body.domain,
      filename: body.filename,
      durationSec: body.durationSec,
      sampleId: body.sampleId,
      videoBase64: body.videoBase64,
      mimeType: body.mimeType,
      creatorName: body.creatorName,
      licenceChoice: body.licenceChoice,
      creditLink: body.creditLink,
    });
    return Response.json(result);
  } catch (error) {
    const capped = dailyCapResponse(error);
    if (capped) return capped;
    throw error;
  }
}
