import { guardMetaRoute } from "@/src/server/meta-guard";
import { forwardSecretOk, SAM_FORWARD_SECRET_HEADER } from "@/src/server/sam-forward";
import { executeSegment, readSegmentBody, segmentTooLargeResponse } from "@/src/server/segment-run";
import type { SegmentRequest } from "@/src/server/types";

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
  const rawBody = await readSegmentBody(request);
  if (rawBody === null) return segmentTooLargeResponse();
  // executeSegment reserves the daily cap in the live client before any Meta fetch.
  return executeSegment(JSON.parse(rawBody) as SegmentRequest);
}
