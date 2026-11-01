import { guardMetaRoute, reserveSegmentCap } from "@/src/server/meta-guard";
import { forwardSamRequest, samForwardDegrade, samForwardEnabled } from "@/src/server/sam-forward";
import { readSegmentBody, segmentTooLargeResponse } from "@/src/server/segment-run";

export const dynamic = "force-dynamic";

function inputKindOf(rawBody: string): "image" | "video_chunk" {
  try {
    const parsed = JSON.parse(rawBody) as { inputKind?: unknown };
    return parsed.inputKind === "video_chunk" ? "video_chunk" : "image";
  } catch {
    return "image";
  }
}

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
  return Response.json(samForwardDegrade({ timedOut: false, inputKind: inputKindOf(rawBody) }));
}
