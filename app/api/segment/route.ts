import { guardMetaRoute, reserveSegmentCap } from "@/src/server/meta-guard";
import { forwardSamRequest, samForwardDegrade } from "@/src/server/sam-forward";
import { executeSegment, readSegmentBody, segmentTooLargeResponse } from "@/src/server/segment-run";
import { modelExecutionMode } from "@/src/server/model-execution";
import { parseSegmentRequest } from "@/src/server/request-validation";

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
  let rawBody: string | null;
  try { rawBody = await readSegmentBody(request); }
  catch { return Response.json({ error: "invalid_request", message: "The request body could not be read." }, { status: 400 }); }
  if (rawBody === null) return segmentTooLargeResponse();
  const parsed = parseSegmentRequest(rawBody);
  if (!parsed.ok) return parsed.response;
  const mode = modelExecutionMode(process.env, "segment");
  if (mode === "forward") {
    const capped = reserveSegmentCap(rawBody);
    if (capped) return capped;
    return forwardSamRequest({
      rawBody,
      env: process.env,
      signal: request.signal,
      contentType: request.headers.get("content-type"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    });
  }
  if (mode === "direct") return executeSegment({ ...parsed.value, signal: request.signal });
  return Response.json(samForwardDegrade({ timedOut: false, inputKind: inputKindOf(rawBody) }));
}
