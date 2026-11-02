import { SPARK_MODEL_ID } from "@/src/models";

/** Steps instruction. It does not ask the model for credit, attribution, or licence. */
export const SPARK_STEPS_INSTRUCTION = `Return JSON only. No markdown.
schemaVersion "1.0.0".
Include title, domain, sourceClip with mediaType and durationSec, and runtimeHints.preferredLiveMode.
The server supplies tutorialId, generation metadata, and rights fields. Do not invent these fields.
For an uploaded clip, the server supplies its actual media type and duration; use source times from the complete clip.
Use only these values:
domain: indian_recipe, non_cooking_diy, other.
sourceClip.mediaType: video/mp4, video/webm.
object role: required_present, required_absent, optional, safety_prop.
successCheck.kind: all_required_present, required_present_and_absent, ordered_presence, manual_confirm_only.
runtimeHints.preferredLiveMode: chunk_video_1_2s, keyframe_still, stills_only.
Prefer keyframe_still for runtimeHints.preferredLiveMode.
Each step needs id, index, instructionText, sourceTimeRange with startSec and endSec, 2 to 4 objects (objectId, noun, role, samPrompt), and successCheck with kind and description.
Use visually checkable objects only. Do not use Muse Image. Do not fetch Instagram.
Do not name people and do not add rights fields.`;

export const SHORT_CLIP_MAX_SEC = 10;
export const DATA_URL_MAX_BYTES = 8 * 1024 * 1024;

export type SparkMediaPlan = "full_video_data_url" | "files_api";

export function chooseSparkMediaPlan(input: { durationSec?: number; byteLength: number }): SparkMediaPlan {
  if (input.durationSec != null && input.durationSec > SHORT_CLIP_MAX_SEC) return "files_api";
  if (input.byteLength > DATA_URL_MAX_BYTES) return "files_api";
  return "full_video_data_url";
}

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_video"; video_url: string }
  | { type: "input_file"; file_id: string }
  | { type: "input_image"; image_url: string };

/**
 * Goal + still instruction. Built on SPARK_STEPS_INSTRUCTION.
 * Image understanding uses a user message `input_image` whose `image_url` is a plain string
 * (public URL or data URL). See https://dev.meta.ai/docs/image-understanding
 */
export function goalInstruction(goal: string): string {
  return `${SPARK_STEPS_INSTRUCTION}
The learner has no tutorial. They stated a goal and attached one still of the workspace.
Return 2 to 4 steps. Each step lists 2 or 3 handheld or manipulable nouns. Put the object the hands use first.
Do not name surfaces, tables, backgrounds, or workspaces. No counter, desk, board, or backdrop.
Safe household tasks only. The camera must be able to check each noun.
If the goal is unsafe, or it is not something a camera can check, return only {"refused":true,"reason":"short reason"} with no steps.
Do not invent tutorialId.
Use only these values:
domain: indian_recipe, non_cooking_diy, other.
sourceClip.mediaType: video/mp4, video/webm.
sourceClip.durationSec greater than 0.
generation.mode: muse_spark_live, muse_spark_curated, hand_authored.
runtimeHints.preferredLiveMode: keyframe_still.
object role: required_present, required_absent, optional, safety_prop.
successCheck.kind: all_required_present, required_present_and_absent, ordered_presence, manual_confirm_only.
tool: muse_spark, sam_3_1, tts, other.
inputKind: transcript, clip, image, video_chunk, text.
Each sourceTimeRange.endSec must be greater than 0.
Goal: ${goal.trim()}`;
}

export function buildSparkResponsesBody(args: {
  instruction?: string;
  videoBase64?: string;
  mimeType?: string;
  fileId?: string;
  transcript?: string;
  imageDataUrl?: string;
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
  if (args.imageDataUrl) {
    content.push({ type: "input_image", image_url: args.imageDataUrl });
  }
  return {
    model: SPARK_MODEL_ID,
    input: [{ type: "message", role: "user", content }],
  };
}
