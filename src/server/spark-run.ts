import { createModelClients } from "@/src/server/factory";
import { dailyCapResponse } from "@/src/server/meta-guard";
import type { SparkRequest } from "@/src/server/types";

/** The spark call used by /api/spark and /api/internal/spark. */
export async function executeSpark(body: SparkRequest, options?: { mockSparkDelayMs?: number }): Promise<Response> {
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
