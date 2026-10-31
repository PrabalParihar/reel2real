import { SPARK_MODEL_ID } from "@/src/models";

/** Steps instruction. It does not ask the model for credit, attribution, or licence. */
export const SPARK_STEPS_INSTRUCTION = `Return JSON only. No markdown.
schemaVersion "1.0.0".
Include title, domain, sourceClip with mediaType and durationSec, generation.modelId "muse-spark-1.3", generation.mode "muse_spark_live", generation.toolCalls, and runtimeHints.preferredLiveMode "keyframe_still".
Each step needs id, index, instructionText, sourceTimeRange with startSec and endSec, 2 to 4 objects (objectId, noun, role, samPrompt), and successCheck with kind and description.
Use visually checkable objects only. Do not use Muse Image. Do not fetch Instagram.
Do not name people and do not add rights fields.`;

export const SHORT_CLIP_MAX_SEC = 10;
export const CHUNK_SEC = 2;
export const DATA_URL_MAX_BYTES = 8 * 1024 * 1024;

export type SparkMediaPlan = "chunk_data_url" | "files_api";

export function chooseSparkMediaPlan(input: { durationSec?: number; byteLength: number }): SparkMediaPlan {
  if (input.durationSec != null && input.durationSec > SHORT_CLIP_MAX_SEC) return "files_api";
  if (input.byteLength > DATA_URL_MAX_BYTES) return "files_api";
  return "chunk_data_url";
}

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_video"; video_url: string }
  | { type: "input_file"; file_id: string };

export function buildSparkResponsesBody(args: {
  instruction?: string;
  videoBase64?: string;
  mimeType?: string;
  fileId?: string;
  transcript?: string;
}) {
  const instruction = args.instruction ?? SPARK_STEPS_INSTRUCTION;
  const content: ContentPart[] = [{ type: "input_text", text: instruction }];
  if (args.fileId) {
    content.push({ type: "input_file", file_id: args.fileId });
  } else if (args.videoBase64) {
    const mime = args.mimeType || "video/mp4";
    content.push({ type: "input_video", video_url: `data:${mime};base64,${args.videoBase64}` });
  } else if (args.transcript?.trim()) {
    content[0] = { type: "input_text", text: `${instruction}\n\nTranscript:\n${args.transcript.trim()}` };
  }
  return {
    model: SPARK_MODEL_ID,
    input: [{ type: "message", role: "user", content }],
  };
}
