import { readFile } from "node:fs/promises";
import { SAM_MODEL_ID, SPARK_MODEL_ID, RESPONSES_URL } from "@/src/models";
import { normalizeSparkPayload } from "@/src/schema/normalize";
import { parseSamBoxes } from "./sam-parse";
import { redactSecrets } from "./redact";
import type { SegmentRequest, SegmentResult, SegmentationClient, SparkClient, SparkRequest, SparkResult, MaskHit } from "./types";

function assertServer() {
  if (typeof window !== "undefined") throw new Error("Model clients are server-only");
}

async function postResponses(key: string, body: unknown, timeoutMs: number): Promise<{ status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    return { status: response.status, text: redactSecrets(text, [key]) };
  } finally {
    clearTimeout(timer);
  }
}

function outputText(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
    };
    if (typeof parsed.output_text === "string") return parsed.output_text;
    const chunks: string[] = [];
    for (const item of parsed.output ?? []) {
      for (const part of item.content ?? []) {
        if (typeof part.text === "string") chunks.push(part.text);
      }
    }
    return chunks.join("\n");
  } catch {
    return payload;
  }
}

function jsonFromText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Spark response did not contain JSON");
  return JSON.parse(text.slice(start, end + 1));
}

const SPARK_PROMPT = `Convert this tutorial into JSON only. No markdown.
Use schemaVersion "1.0.0". Include title, sampleLabel true, attribution with creditLine, sourceClip, generation.modelId "muse-spark-1.3", generation.toolCalls, runtimeHints.preferredLiveMode "keyframe_still", and steps.
Each step needs id, index, instructionText, sourceTimeRange, credit.creditLine, 2 to 4 objects (objectId, noun, role, samPrompt), and successCheck.
Visually checkable objects only. Do not use Muse Image. Do not fetch Instagram.
Tutorial:
`;

export function createLiveSparkClient(key: string): SparkClient {
  assertServer();
  return {
    mode: "live",
    modelId: SPARK_MODEL_ID,
    async generateSteps(input: SparkRequest): Promise<SparkResult> {
      const started = performance.now();
      const transcript = input.transcript?.trim() || `${input.title ?? "Tutorial"} (${input.domain ?? "other"})`;
      try {
        const response = await postResponses(
          key,
          {
            model: SPARK_MODEL_ID,
            input: [
              {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: SPARK_PROMPT + transcript }],
              },
            ],
          },
          30000,
        );
        const latencyMs = Math.round(performance.now() - started);
        if (response.status < 200 || response.status >= 300) {
          return {
            mode: "live",
            modelId: SPARK_MODEL_ID,
            latencyMs,
            schemaValid: false,
            parseOk: false,
            errors: [`Spark failed (HTTP ${response.status}).`],
            tutorial: null,
            toolCalls: [],
          };
        }
        let parsed: unknown;
        try {
          parsed = jsonFromText(outputText(response.text));
        } catch {
          return {
            mode: "live",
            modelId: SPARK_MODEL_ID,
            latencyMs,
            schemaValid: false,
            parseOk: false,
            errors: ["Spark JSON could not be parsed."],
            tutorial: null,
            toolCalls: [],
          };
        }
        const normalized = normalizeSparkPayload(parsed, {
          title: input.title,
          domain: input.domain,
          creditLine: input.creditLine,
          filename: input.filename,
          durationSec: input.durationSec,
          mode: "muse_spark_live",
        });
        const toolCalls = [
          {
            tool: "muse_spark" as const,
            modelId: SPARK_MODEL_ID,
            purpose: "tutorial_transcript_to_steps_json",
            inputKind: "transcript" as const,
            latencyMs,
          },
        ];
        if (!normalized.ok) {
          return {
            mode: "live",
            modelId: SPARK_MODEL_ID,
            latencyMs,
            schemaValid: false,
            parseOk: true,
            errors: normalized.errors.map((error) => error.message),
            tutorial: null,
            toolCalls,
          };
        }
        normalized.value.generation.toolCalls = toolCalls;
        return {
          mode: "live",
          modelId: SPARK_MODEL_ID,
          latencyMs,
          schemaValid: true,
          parseOk: true,
          errors: [],
          tutorial: normalized.value,
          toolCalls,
        };
      } catch (error) {
        const latencyMs = Math.round(performance.now() - started);
        const message = error instanceof Error ? error.message : "Spark request failed";
        return {
          mode: "live",
          modelId: SPARK_MODEL_ID,
          latencyMs,
          schemaValid: false,
          parseOk: false,
          errors: [redactSecrets(message, [key]) || "Spark request failed"],
          tutorial: null,
          toolCalls: [],
        };
      }
    },
  };
}

function dataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`;
}


export function createLiveSegmentationClient(key: string): SegmentationClient {
  assertServer();
  return {
    mode: "live",
    modelId: SAM_MODEL_ID,
    async segment(input: SegmentRequest): Promise<SegmentResult> {
      const started = performance.now();
      const prompts = input.prompts.slice(0, 4);
      const masks: MaskHit[] = [];
      let status = 0;
      let failed = "";
      try {
        let base64 = input.mediaBase64;
        if (!base64 && input.mediaPath) {
          const bytes = await readFile(input.mediaPath);
          base64 = bytes.toString("base64");
        }
        if (!base64) throw new Error("No frame was attached");
        const mime = input.mimeType || (input.inputKind === "video_chunk" ? "video/mp4" : "image/jpeg");
        const mediaPart = input.inputKind === "video_chunk"
          ? { type: "input_video", video_url: dataUrl(mime, base64) }
          : { type: "input_image", image_url: dataUrl(mime, base64) };
        for (const prompt of prompts) {
          const response = await postResponses(
            key,
            {
              model: SAM_MODEL_ID,
              input: [
                {
                  type: "message",
                  role: "user",
                  content: [
                    { type: "input_text", text: prompt.samPrompt },
                    mediaPart,
                  ],
                },
              ],
            },
            input.timeoutMs,
          );
          status = response.status;
          if (response.status < 200 || response.status >= 300) {
            failed = `SAM failed (HTTP ${response.status}).`;
            masks.push({ objectId: prompt.objectId, noun: prompt.noun, present: false });
            continue;
          }
          const boxes = parseSamBoxes(outputText(response.text));
          const present = boxes.length > 0;
          masks.push({
            objectId: prompt.objectId,
            noun: prompt.noun,
            present,
            trackId: present ? `f${boxes[0].frame}-o${boxes[0].ordinal}` : undefined,
            box: boxes[0]?.box,
          });
        }
        const latencyMs = Math.round(performance.now() - started);
        return {
          mode: "live",
          modelId: SAM_MODEL_ID,
          latencyMs,
          ok: !failed,
          timedOut: false,
          error: failed || undefined,
          httpStatus: status,
          inputKind: input.inputKind,
          masks,
          toolCall: {
            tool: "sam_3_1",
            modelId: SAM_MODEL_ID,
            purpose: input.inputKind === "video_chunk" ? "chunk_object_masks" : "keyframe_object_masks",
            inputKind: input.inputKind === "video_chunk" ? "video_chunk" : "image",
            latencyMs,
          },
        };
      } catch (error) {
        const latencyMs = Math.round(performance.now() - started);
        const aborted = error instanceof Error && error.name === "AbortError";
        const message = aborted ? "SAM timed out." : redactSecrets(error instanceof Error ? error.message : "SAM request failed", [key]);
        return {
          mode: "live",
          modelId: SAM_MODEL_ID,
          latencyMs,
          ok: false,
          timedOut: aborted,
          error: message,
          httpStatus: status || undefined,
          inputKind: input.inputKind,
          masks,
          toolCall: {
            tool: "sam_3_1",
            modelId: SAM_MODEL_ID,
            purpose: "keyframe_object_masks",
            inputKind: input.inputKind === "video_chunk" ? "video_chunk" : "image",
            latencyMs,
          },
        };
      }
    },
  };
}
