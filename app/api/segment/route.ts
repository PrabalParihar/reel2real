import { TIMEOUTS } from "@/src/fsm/types";
import { createModelClients } from "@/src/server/factory";
import type { SegmentRequest } from "@/src/server/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as SegmentRequest;
  const clients = createModelClients(process.env);
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
}
