import { API_ORIGIN, SAM_MODEL_ID } from "@/src/models";
import { META_USER_AGENT } from "./meta-log";

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
    "User-Agent": META_USER_AGENT,
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

/** A mask is present when the output text contains the mask token. */
export function samMaskPresent(text: string): boolean {
  return text.includes("<|mask;");
}

/** Join streamed output_text deltas. A JSON body falls through to output_text. */
export function samOutputText(payload: string): string {
  if (payload.includes("data:")) {
    const chunks: string[] = [];
    for (const line of payload.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data) as { type?: string; delta?: string; output_text?: string };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") chunks.push(event.delta);
      } catch {
        continue;
      }
    }
    if (chunks.length) return chunks.join("");
  }
  try {
    const parsed = JSON.parse(payload) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    if (typeof parsed.output_text === "string") return parsed.output_text;
    const chunks: string[] = [];
    for (const item of parsed.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === "string") chunks.push(part.text);
      }
    }
    if (chunks.length) return chunks.join("\n");
  } catch {
    return payload;
  }
  return payload;
}

export { samFailureLog } from "./meta-log";
