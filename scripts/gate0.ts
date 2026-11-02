import { readFile, stat, mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { TIMEOUTS } from "@/src/fsm/types";
import { decideGate0, type GateRun } from "@/src/gate0/decide";
import { formatGateTable } from "@/src/gate0/table";
import { SAM_MODEL_ID, SPARK_MODEL_ID } from "@/src/models";
import { createModelClients } from "@/src/server/factory";
import { decodeModelMedia, SEGMENT_MAX_BYTES, validateClipDuration } from "@/src/server/model-media";
import type { LicenceChoice, ModelClients } from "@/src/server/types";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function clipDuration(clipPath: string): number {
  const result = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", clipPath], { encoding: "utf8", timeout: 5000, maxBuffer: 64 * 1024 });
  if (result.status !== 0) throw new Error("Gate 0 needs ffprobe and a readable MP4/WebM clip; duration inspection failed.");
  const duration = Number(result.stdout.trim());
  validateClipDuration(duration);
  return duration;
}

export async function runGate0(options: {
  clipPath: string;
  runs: number;
  creatorName: string;
  licenceChoice: LicenceChoice;
  clients?: ModelClients;
  /** Live calls require this explicit opt-in. Injected test clients never use credentials. */
  allowLive?: boolean;
  transcript?: string;
}): Promise<{ text: string; exitCode: number }> {
  if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 3) throw new Error("Gate 0 supports one to three runs; the CLI requires three.");
  if (!options.creatorName?.trim() || !["self_filmed", "permission_granted"].includes(options.licenceChoice)) throw new Error("Gate 0 requires the clip creator and an explicit licence choice.");
  const info = await stat(options.clipPath);
  if (!info.isFile() || !info.size || info.size > SEGMENT_MAX_BYTES) throw new Error("Gate 0 fixture must be a local MP4/WebM file of at most 5 MiB for the SAM path.");
  const bytes = await readFile(options.clipPath);
  const mimeType = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ? "video/webm" : "video/mp4";
  const videoBase64 = bytes.toString("base64");
  decodeModelMedia(videoBase64, mimeType, "video_chunk", SEGMENT_MAX_BYTES);
  const durationSec = clipDuration(options.clipPath);
  const clients = options.clients ?? createModelClients(options.allowLive ? process.env : {});
  const dir = await mkdtemp(path.join(tmpdir(), "reel2real-gate0-"));
  const framePath = path.join(dir, "frame.jpg");
  const runs: GateRun[] = [];
  let frameBase64: string | undefined;
  try {
    const extracted = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", options.clipPath, "-frames:v", "1", framePath], { stdio: "ignore", timeout: 5000 });
    if (extracted.status === 0) frameBase64 = (await readFile(framePath)).toString("base64");
    for (let index = 0; index < options.runs; index += 1) {
      const clip = await clients.segmentation.segment({
        inputKind: "video_chunk", mediaBase64: videoBase64, mimeType,
        prompts: [
          { objectId: "obj_mortar", noun: "mortar", samPrompt: "stone mortar" },
          { objectId: "obj_pestle", noun: "pestle", samPrompt: "stone pestle" },
          { objectId: "obj_cup", noun: "cup", samPrompt: "tea cup" },
        ],
        timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS, scenario: "on_track", phase: index,
      });
      let stillOk: boolean | null = null;
      let stillMs: number | null = null;
      if (frameBase64) {
        const still = await clients.segmentation.segment({
          inputKind: "image", mediaBase64: frameBase64, mimeType: "image/jpeg",
          prompts: [
            { objectId: "obj_cup", noun: "cup", samPrompt: "tea cup" },
            { objectId: "obj_mortar", noun: "mortar", samPrompt: "stone mortar" },
          ],
          timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS, scenario: "on_track",
        });
        stillOk = still.ok && still.masks.some((mask) => mask.present);
        stillMs = still.latencyMs;
      }
      const spark = await clients.spark.generateSteps({
        videoBase64, mimeType, durationSec, filename: path.basename(options.clipPath),
        creatorName: options.creatorName, licenceChoice: options.licenceChoice,
        transcript: options.transcript, domain: "indian_recipe",
      });
      runs.push({
        sam_still_ok: stillOk, sam_still_full_ms: stillMs,
        sam_clip_ok: clip.ok && clip.masks.some((mask) => mask.present),
        sam_clip_full_ms: clip.timedOut ? null : clip.latencyMs,
        sam_clip_timed_out: clip.timedOut,
        sam_objects_returned: clip.masks.filter((mask) => mask.present).length,
        spark_ok: spark.schemaValid && spark.parseOk, spark_latency_ms: spark.latencyMs,
        spark_json_parse_ok: spark.parseOk, spark_schema_valid: spark.schemaValid,
        steps_count: spark.tutorial?.steps.length ?? 0,
      });
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
  const decision = decideGate0(runs, clients.mode);
  const text = [
    `mode: ${clients.mode}`, `sam_model_id: ${SAM_MODEL_ID}`, `spark_model_id: ${SPARK_MODEL_ID}`,
    `clip: ${options.clipPath}`, `clip_bytes: ${bytes.length}`, `mime_type: ${mimeType}`, `duration_sec: ${durationSec}`,
    "Timing: full multi-noun request completion, including response body.",
    "First streamed mask: not measured",
    "Call budget per run: up to 5 SAM responses; Spark 1 inline response or 1 upload + 1 response; inline rejection fallback adds 1 response.",
    "Provider-call attempts are subject to the process daily cap. This harness does not measure billing or validate action coverage/box relevance.",
    "", formatGateTable(runs, decision, clients.mode), "",
    `Gate 0 decision: ${decision.decision}`, `Live mode: ${decision.liveMode}`,
    `Fallback armed: ${decision.fallbackArmed ? "yes" : "no"}`, `Reason: ${decision.reason}`,
  ].join("\n");
  return { text, exitCode: decision.decision === "nogo_escalate" ? 2 : 0 };
}

async function main() {
  const clipPath = process.argv[2];
  const runs = Number(argValue("--runs") ?? 3);
  const creatorName = argValue("--creator");
  const licenceChoice = argValue("--licence");
  if (!clipPath || clipPath.startsWith("--") || !creatorName || !["self_filmed", "permission_granted"].includes(licenceChoice ?? "") || runs !== 3) {
    console.error('Usage: npm run gate0 -- <clip-path> --creator "Creator" --licence self_filmed|permission_granted [--runs 3] [--live]');
    process.exitCode = 1;
    return;
  }
  try {
    const result = await runGate0({ clipPath, runs, creatorName, licenceChoice: licenceChoice as LicenceChoice, allowLive: process.argv.includes("--live") });
    console.log(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Gate 0 failed.");
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) void main();
