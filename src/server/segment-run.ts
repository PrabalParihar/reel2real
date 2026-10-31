import { TIMEOUTS } from "@/src/fsm/types";
import { createModelClients } from "@/src/server/factory";
import { dailyCapResponse } from "@/src/server/meta-guard";
import type { SegmentRequest } from "@/src/server/types";

/** Neither segment route had a body limit. Both reject anything over 8MB. */
export const SEGMENT_MAX_BODY_BYTES = 8 * 1024 * 1024;

export function segmentTooLargeResponse(): Response {
  return new Response(null, {
    status: 413,
    headers: { "cache-control": "no-store" },
  });
}

/** Null when the declared or actual body is over the segment limit. */
export async function readSegmentBody(request: Request): Promise<string | null> {
  const header = request.headers.get("content-length");
  if (header) {
    const declared = Number(header);
    if (Number.isFinite(declared) && declared > SEGMENT_MAX_BODY_BYTES) return null;
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > SEGMENT_MAX_BODY_BYTES) return null;
  return rawBody;
}

/**
 * The segment call used by /api/segment and /api/internal/segment.
 * Request fields stay the same as the public route.
 */
export async function executeSegment(body: SegmentRequest): Promise<Response> {
  const clients = createModelClients(process.env);
  try {
    const result = await clients.segmentation.segment({
      inputKind: body.inputKind === "video_chunk" ? "video_chunk" : "image",
      mediaBase64: body.mediaBase64,
      mimeType: body.mimeType,
      prompts: (body.prompts ?? []).slice(0, 4),
      timeoutMs: Math.min(body.timeoutMs || TIMEOUTS.SAM_TIMEOUT_MS, TIMEOUTS.SAM_TIMEOUT_MS),
      scenario: clients.mode === "mock" ? body.scenario : undefined,
      phase: clients.mode === "mock" ? body.phase : undefined,
    });
    return Response.json(result);
  } catch (error) {
    const capped = dailyCapResponse(error);
    if (capped) return capped;
    throw error;
  }
}
