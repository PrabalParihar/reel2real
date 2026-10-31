import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SAM_MODEL_ID, SPARK_MODEL_ID, RESPONSES_URL, API_ORIGIN } from "@/src/models";
import { tutorialFromSparkPayload, type UserAttribution } from "@/src/schema/attribution";
import { parseSamBoxes } from "./sam-parse";
import { redactSecrets } from "./redact";
import { buildSparkResponsesBody, chooseSparkMediaPlan, SPARK_STEPS_INSTRUCTION } from "./spark-request";
import { sampleById } from "./fixtures";
import { consumeMetaCalls, DailyCapError } from "./daily-cap";
import type { SegmentRequest, SegmentResult, SegmentationClient, SparkClient, SparkRequest, SparkResult, MaskHit } from "./types";

function assertServer() {
  if (typeof window !== "undefined") throw new Error("Model clients are server-only");
}

function reserveMetaCall() {
  const result = consumeMetaCalls();
  if (!result.ok) throw new DailyCapError(result.message);
}

async function postResponses(key: string, body: unknown, timeoutMs: number): Promise<{ status: number; text: string }> {
  reserveMetaCall();
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

const FILES_URL = `${API_ORIGIN}/v1/files`;
const SPARK_TIMEOUT_MS = 45000;

function userMeta(input: SparkRequest): UserAttribution | null {
  if (!input.creatorName?.trim() || !input.licenceChoice) return null;
  return { creatorName: input.creatorName, licence: input.licenceChoice, creditLink: input.creditLink };
}

function fail(latencyMs: number, errors: string[], inputKind: SparkResult["inputKind"]): SparkResult {
  return {
    mode: "live",
    modelId: SPARK_MODEL_ID,
    latencyMs,
    schemaValid: false,
    parseOk: false,
    errors,
    tutorial: null,
    toolCalls: [],
    inputKind,
  };
}

async function finishPayload(
  payload: unknown,
  meta: UserAttribution,
  input: SparkRequest,
  latencyMs: number,
  inputKind: SparkResult["inputKind"],
): Promise<SparkResult> {
  const toolCalls = [
    {
      tool: "muse_spark" as const,
      modelId: SPARK_MODEL_ID,
      purpose: inputKind === "clip" ? "tutorial_clip_to_steps_json" : "tutorial_transcript_to_steps_json",
      inputKind: inputKind === "clip" ? "clip" as const : "transcript" as const,
      latencyMs,
    },
  ];
  const normalized = tutorialFromSparkPayload(payload, meta, {
    title: input.title,
    domain: input.domain,
    filename: input.filename,
    durationSec: input.durationSec,
    mode: "muse_spark_live",
  });
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
      inputKind,
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
    inputKind,
  };
}

async function twoSecondChunk(base64: string): Promise<string> {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.status !== 0) return base64;
  const dir = await mkdtemp(path.join(tmpdir(), "reel2real-spark-"));
  try {
    const source = path.join(dir, "in.mp4");
    const target = path.join(dir, "chunk.mp4");
    await writeFile(source, Buffer.from(base64, "base64"));
    const copied = spawnSync("ffmpeg", ["-y", "-i", source, "-t", "2", "-c", "copy", target], { stdio: "ignore" });
    if (copied.status !== 0) {
      spawnSync("ffmpeg", ["-y", "-i", source, "-t", "2", "-c:v", "libx264", "-preset", "veryfast", "-an", target], { stdio: "ignore" });
    }
    const chunk = await readFile(target);
    return chunk.length > 0 ? chunk.toString("base64") : base64;
  } catch {
    return base64;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function uploadClipFile(key: string, base64: string, mime: string): Promise<{ id?: string; status: number }> {
  reserveMetaCall();
  const bytes = Buffer.from(base64, "base64");
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), mime.includes("webm") ? "clip.webm" : "clip.mp4");
  const response = await fetch(FILES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!response.ok) return { status: response.status };
  const payload = (await response.json()) as { id?: string };
  return { id: payload.id, status: response.status };
}

export function createLiveSparkClient(key: string): SparkClient {
  assertServer();
  return {
    mode: "live",
    modelId: SPARK_MODEL_ID,
    async generateSteps(input: SparkRequest): Promise<SparkResult> {
      const started = performance.now();
      const meta = userMeta(input);
      try {
        if (!input.videoBase64) {
          if (input.sampleId && !input.transcript) {
            const curated = sampleById(input.sampleId);
            const owned = meta
              ? (await finishPayload(curated, meta, input, 0, "sample")).tutorial
              : curated;
            return {
              mode: "live",
              modelId: SPARK_MODEL_ID,
              latencyMs: Math.round(performance.now() - started),
              schemaValid: true,
              parseOk: true,
              errors: [],
              tutorial: owned,
              toolCalls: curated.generation.toolCalls,
              inputKind: "sample",
            };
          }
          if (!meta) return fail(0, ["Creator name and licence are required."], "transcript");
          const response = await postResponses(key, buildSparkResponsesBody({ transcript: input.transcript || input.title || "Tutorial" }), SPARK_TIMEOUT_MS);
          const latencyMs = Math.round(performance.now() - started);
          if (response.status < 200 || response.status >= 300) {
            return fail(latencyMs, [`Spark failed (HTTP ${response.status}).`], "transcript");
          }
          try {
            return await finishPayload(jsonFromText(outputText(response.text)), meta, input, latencyMs, "transcript");
          } catch {
            return fail(latencyMs, ["Spark JSON could not be parsed."], "transcript");
          }
        }
        if (!meta) return fail(0, ["Creator name and licence are required."], "clip");
        const mime = input.mimeType || "video/mp4";
        const bytes = Buffer.from(input.videoBase64, "base64").length;
        const plan = chooseSparkMediaPlan({ durationSec: input.durationSec, byteLength: bytes });
        let dataUrlError = "";
        if (plan === "chunk_data_url") {
          const chunk = await twoSecondChunk(input.videoBase64);
          const response = await postResponses(
            key,
            buildSparkResponsesBody({ instruction: SPARK_STEPS_INSTRUCTION, videoBase64: chunk, mimeType: mime }),
            SPARK_TIMEOUT_MS,
          );
          const latencyMs = Math.round(performance.now() - started);
          if (response.status >= 200 && response.status < 300) {
            try {
              return await finishPayload(jsonFromText(outputText(response.text)), meta, input, latencyMs, "clip");
            } catch {
              return fail(latencyMs, ["Spark JSON could not be parsed."], "clip");
            }
          }
          if (response.status !== 413 && response.status !== 400) {
            return fail(latencyMs, [`Spark failed (HTTP ${response.status}).`], "clip");
          }
          dataUrlError = `HTTP ${response.status}`;
        }
        const uploaded = await uploadClipFile(key, input.videoBase64, mime);
        if (!uploaded.id) {
          const latencyMs = Math.round(performance.now() - started);
          const both = dataUrlError ? "The short upload and the files upload both failed." : `Files upload failed (HTTP ${uploaded.status}).`;
          return fail(latencyMs, [both], "clip");
        }
        const response = await postResponses(
          key,
          buildSparkResponsesBody({ instruction: SPARK_STEPS_INSTRUCTION, fileId: uploaded.id }),
          SPARK_TIMEOUT_MS,
        );
        const latencyMs = Math.round(performance.now() - started);
        if (response.status < 200 || response.status >= 300) {
          return fail(latencyMs, [dataUrlError ? "The short upload and the files upload both failed." : `Spark failed (HTTP ${response.status}).`], "clip");
        }
        try {
          return await finishPayload(jsonFromText(outputText(response.text)), meta, input, latencyMs, "clip");
        } catch {
          return fail(latencyMs, ["Spark JSON could not be parsed."], "clip");
        }
      } catch (error) {
        if (error instanceof DailyCapError) throw error;
        const latencyMs = Math.round(performance.now() - started);
        const message = error instanceof Error ? error.message : "Spark request failed";
        return fail(latencyMs, [redactSecrets(message, [key]) || "Spark request failed"], input.videoBase64 ? "clip" : "transcript");
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
        if (error instanceof DailyCapError) throw error;
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
