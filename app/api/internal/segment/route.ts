import { guardMetaRoute } from "@/src/server/meta-guard";
import { forwardSecretOk, SAM_FORWARD_SECRET_HEADER } from "@/src/server/sam-forward";
import { executeSegment } from "@/src/server/segment-run";
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
  const body = (await request.json()) as SegmentRequest;
  return executeSegment(body);
}
