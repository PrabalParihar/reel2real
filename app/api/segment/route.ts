import { guardMetaRoute, reserveSegmentCap } from "@/src/server/meta-guard";
import { forwardSamRequest, samForwardEnabled } from "@/src/server/sam-forward";
import { executeSegment, readSegmentBody, segmentTooLargeResponse } from "@/src/server/segment-run";
import type { SegmentRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  const rawBody = await readSegmentBody(request);
  if (rawBody === null) return segmentTooLargeResponse();
  if (samForwardEnabled(process.env)) {
    const capped = reserveSegmentCap(rawBody);
    if (capped) return capped;
    return forwardSamRequest({
      rawBody,
      env: process.env,
      contentType: request.headers.get("content-type"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    });
  }
  return executeSegment(JSON.parse(rawBody) as SegmentRequest);
}
