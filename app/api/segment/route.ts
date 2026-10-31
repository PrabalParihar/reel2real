import { guardMetaRoute } from "@/src/server/meta-guard";
import { forwardSamRequest, samForwardEnabled } from "@/src/server/sam-forward";
import { executeSegment } from "@/src/server/segment-run";
import type { SegmentRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  if (samForwardEnabled(process.env)) {
    const rawBody = await request.text();
    return forwardSamRequest({
      rawBody,
      env: process.env,
      contentType: request.headers.get("content-type"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    });
  }
  const body = (await request.json()) as SegmentRequest;
  return executeSegment(body);
}
