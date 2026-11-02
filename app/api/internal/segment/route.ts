import { guardMetaRoute } from "@/src/server/meta-guard";
import { forwardSecretOk, SAM_FORWARD_SECRET_HEADER } from "@/src/server/sam-forward";
import { executeSegment, readSegmentBody, segmentTooLargeResponse } from "@/src/server/segment-run";
import { parseSegmentRequest } from "@/src/server/request-validation";

export const dynamic = "force-dynamic";

function secretRejected(): Response {
  return new Response(null, {
    status: 404,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!forwardSecretOk(request.headers.get(SAM_FORWARD_SECRET_HEADER), process.env)) {
    return secretRejected();
  }
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  let rawBody: string | null;
  try { rawBody = await readSegmentBody(request); }
  catch { return Response.json({ error: "invalid_request", message: "The request body could not be read." }, { status: 400 }); }
  if (rawBody === null) return segmentTooLargeResponse();
  const parsed = parseSegmentRequest(rawBody);
  if (!parsed.ok) return parsed.response;
  // executeSegment reserves the daily cap in the live client before any Meta fetch.
  return executeSegment({ ...parsed.value, signal: request.signal });
}
