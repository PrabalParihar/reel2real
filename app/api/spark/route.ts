import { createModelClients } from "@/src/server/factory";
import type { SparkRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as SparkRequest;
  const clients = createModelClients(process.env, { mockSparkDelayMs: 2800 });
  const result = await clients.spark.generateSteps({
    transcript: body.transcript,
    title: body.title,
    domain: body.domain,
    filename: body.filename,
    creditLine: body.creditLine,
    durationSec: body.durationSec,
    sampleId: body.sampleId,
  });
  return Response.json(result);
}
