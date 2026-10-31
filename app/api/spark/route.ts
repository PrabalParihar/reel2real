import { createModelClients } from "@/src/server/factory";
import { dailyCapResponse, guardMetaRoute } from "@/src/server/meta-guard";
import type { SparkRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  const body = (await request.json()) as SparkRequest;
  const clients = createModelClients(process.env, { mockSparkDelayMs: 2800 });
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
