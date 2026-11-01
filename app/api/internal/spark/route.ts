import { guardMetaRoute } from "@/src/server/meta-guard";
import { museSecretRejected, museTooLargeResponse, readMuseBody } from "@/src/server/muse-forward";
import { forwardSecretOk, SAM_FORWARD_SECRET_HEADER } from "@/src/server/sam-forward";
import { executeSpark } from "@/src/server/spark-run";
import type { SparkRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

function rejected(): Response {
  return museSecretRejected();
}

export function GET() { return rejected(); }
export function PUT() { return rejected(); }
export function PATCH() { return rejected(); }
export function DELETE() { return rejected(); }
export function HEAD() { return rejected(); }

export async function POST(request: Request) {
  if (!forwardSecretOk(request.headers.get(SAM_FORWARD_SECRET_HEADER), process.env)) {
    return rejected();
  }
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  const rawBody = await readMuseBody(request);
  if (rawBody === null) return museTooLargeResponse();
  let body: SparkRequest;
  try {
    body = JSON.parse(rawBody) as SparkRequest;
  } catch {
    return Response.json({ error: "invalid_json", message: "The request was not JSON." }, { status: 400 });
  }
  return executeSpark(body);
}
