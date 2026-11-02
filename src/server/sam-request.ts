import { API_ORIGIN, SAM_MODEL_ID } from "@/src/models";
import { decodeMaskToRaster } from "@meta-sam/parser";

/** Documented Responses base. Railway does not set a base-URL variable. */
export const DEFAULT_API_BASE = `${API_ORIGIN}/v1`;

/**
 * Optional `META_API_BASE` overrides the base. Empty or missing stays on
 * https://api.meta.ai/v1 so the path is /v1/responses, not a bare origin.
 */
export function responsesUrl(env: Record<string, string | undefined> = {}): string {
  const configured = env.META_API_BASE?.trim().replace(/\/+$/, "");
  const base = configured || DEFAULT_API_BASE;
  return `${base}/responses`;
}

export function samRequestHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
}

/** Gate 0 still request. One noun, one image, streamed one_bit masks. */
export function buildSamResponsesBody(args: { prompt: string; imageDataUrl?: string; videoDataUrl?: string }) {
  const media = args.videoDataUrl
    ? { type: "input_video" as const, video_url: args.videoDataUrl }
    : { type: "input_image" as const, image_url: args.imageDataUrl ?? "" };
  return {
    model: SAM_MODEL_ID,
    stream: true as const,
    metadata: { mask_encoding: "one_bit" as const },
    input: [
      {
        type: "message" as const,
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: args.prompt },
          media,
        ],
      },
    ],
  };
}

/** Reject truncated tokens rather than treating them as positive detections. */
export function samMaskPresent(text: string): boolean {
  if (!text.includes("<|mask;")) return false;
  const tokens = [...text.matchAll(/<\|mask;([^|>]+)\|>/g)];
  if (!tokens.length || tokens.length !== text.split("<|mask;").length - 1) throw new Error("SAM returned a malformed mask token.");
  let present = false;
  for (const token of tokens) {
    const fields = Object.fromEntries(token[1].split(";").map((part) => { const at = part.indexOf("="); return [part.slice(0, at), part.slice(at + 1)]; }));
    const encoded = /^(\d+),(\d+),([!~])(.+)$/.exec(fields.data ?? "");
    if (!/^\d+$/.test(fields.x ?? "") || !/^\d+$/.test(fields.y ?? "") || !encoded) throw new Error("SAM returned a malformed mask token.");
    const height = Number(encoded[1]);
    const width = Number(encoded[2]);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width * height > 4 * 1024 * 1024) throw new Error("SAM mask dimensions exceed the supported limit.");
    const raster = decodeMaskToRaster({ width, height, encoding: encoded[3] === "!" ? "one_bit" : "lossless", payload: encoded[3] + encoded[4] });
    if (raster.some((pixel) => pixel !== 0)) present = true;
  }
  return present;
}

type SamEnvelope = { type?: string; status?: string; error?: unknown; delta?: string; output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; response?: SamEnvelope };

function assertSuccessfulEnvelope(event: SamEnvelope) {
  if (!event || typeof event !== "object" || event.error || event.type === "error" || /(?:failed|incomplete|cancelled)$/.test(event.type ?? "") || (event.status && event.status !== "completed" && event.status !== "in_progress")) {
    throw new Error("SAM returned an upstream error or incomplete response.");
  }
  if (event.response) assertSuccessfulEnvelope(event.response);
}

function envelopeText(event: SamEnvelope): string {
  if (typeof event.output_text === "string") return event.output_text;
  return (event.output ?? []).flatMap((item) => item.content ?? []).filter((part) => typeof part.text === "string").map((part) => part.text).join("\n");
}

/** Only a complete successful envelope can establish object absence. */
export function samOutputText(payload: string): string {
  if (/^data:/m.test(payload)) {
    const chunks: string[] = [];
    let completed = false;
    let seenResponse = false;
    let finalText = "";
    for (const line of payload.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") { completed = true; continue; }
      const event = JSON.parse(data) as SamEnvelope;
      assertSuccessfulEnvelope(event);
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") { chunks.push(event.delta); seenResponse = true; }
      if (event.type === "response.completed") { completed = true; seenResponse = true; finalText = envelopeText(event.response ?? event); }
    }
    if (!completed || !seenResponse) throw new Error("SAM stream ended before a complete result.");
    return chunks.length ? chunks.join("") : finalText;
  }
  const parsed = JSON.parse(payload) as SamEnvelope;
  assertSuccessfulEnvelope(parsed);
  if (parsed.status && parsed.status !== "completed") throw new Error("SAM response is incomplete.");
  if (typeof parsed.output_text !== "string" && !Array.isArray(parsed.output)) throw new Error("SAM response has no output envelope.");
  return envelopeText(parsed);
}

export { samFailureLog } from "./meta-log";
