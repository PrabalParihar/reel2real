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
import type { ModelClients } from "@/src/server/types";

const TRANSCRIPT = "Sample masala chai. Crush ginger and cardamom in a mortar, then set the cup fully in frame.";

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function extractFrame(clipPath: string): Promise<string | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "reel2real-gate0-"));
  const dest = path.join(dir, "frame.jpg");
  const result = spawnSync("ffmpeg", ["-y", "-i", clipPath, "-frames:v", "1", dest], { stdio: "ignore" });
  if (result.status !== 0) {
    await rm(dir, { recursive: true, force: true });
    return null;
  }
  return dest;
}

export async function runGate0(options: {
  clipPath: string;
  runs: number;
  clients?: ModelClients;
  transcript?: string;
}): Promise<{ text: string; exitCode: number }> {
  const clients = options.clients ?? createModelClients(process.env);
  const runs: GateRun[] = [];
  const framePath = await extractFrame(options.clipPath);
  for (let index = 0; index < options.runs; index += 1) {
    const clip = await clients.segmentation.segment({
      inputKind: "video_chunk",
      mediaPath: options.clipPath,
      mimeType: "video/mp4",
      prompts: [
        { objectId: "obj_mortar", noun: "mortar", samPrompt: "stone mortar" },
        { objectId: "obj_pestle", noun: "pestle", samPrompt: "stone pestle" },
        { objectId: "obj_cup", noun: "cup", samPrompt: "tea cup" },
      ],
      timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS,
      scenario: "on_track",
      phase: index,
    });
    let stillOk: boolean | null = null;
    let stillMs: number | null = null;
    if (framePath) {
      const still = await clients.segmentation.segment({
        inputKind: "image",
        mediaPath: framePath,
        mimeType: "image/jpeg",
        prompts: [
          { objectId: "obj_cup", noun: "cup", samPrompt: "tea cup" },
          { objectId: "obj_mortar", noun: "mortar", samPrompt: "stone mortar" },
        ],
        timeoutMs: TIMEOUTS.SAM_TIMEOUT_MS,
        scenario: "on_track",
      });
      stillOk = still.ok && still.masks.some((mask) => mask.present);
      stillMs = still.latencyMs;
    }
    const spark = await clients.spark.generateSteps({
      transcript: options.transcript ?? TRANSCRIPT,
      sampleId: "masala-chai",
      domain: "indian_recipe",
    });
    runs.push({
      sam_still_ok: stillOk,
      sam_still_ttfm_ms: stillMs,
      sam_clip_ok: clip.ok && clip.masks.some((mask) => mask.present),
      sam_clip_ttfm_ms: clip.timedOut ? null : clip.latencyMs,
      sam_clip_timed_out: clip.timedOut,
      sam_objects_returned: clip.masks.filter((mask) => mask.present).length,
      spark_ok: spark.schemaValid && spark.parseOk,
      spark_latency_ms: spark.latencyMs,
      spark_json_parse_ok: spark.parseOk,
      spark_schema_valid: spark.schemaValid,
      steps_count: spark.tutorial?.steps.length ?? 0,
    });
  }
  if (framePath) await rm(path.dirname(framePath), { recursive: true, force: true });
  const decision = decideGate0(runs, clients.mode);
  const table = formatGateTable(runs, decision, clients.mode);
  const text = [
    `mode: ${clients.mode}`,
    `sam_model_id: ${SAM_MODEL_ID}`,
    `spark_model_id: ${SPARK_MODEL_ID}`,
    `clip: ${options.clipPath}`,
    "",
    table,
    "",
    `Gate 0 decision: ${decision.decision}`,
    `Live mode: ${decision.liveMode}`,
    `Fallback armed: ${decision.fallbackArmed ? "yes" : "no"}`,
    `Reason: ${decision.reason}`,
    "META_MODEL_API_KEY present: " + (clients.mode === "live" ? "yes" : "no"),
  ].join("\n");
  const exitCode = decision.decision === "nogo_escalate" ? 2 : 0;
  return { text, exitCode };
}

async function main() {
  const clipPath = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const runs = Number(argValue("--runs") ?? 3);
  if (!clipPath) {
    console.error("Usage: npm run gate0 -- <clip-path> [--runs 3]");
    process.exit(1);
  }
  if (!Number.isInteger(runs) || runs < 3) {
    console.error("Gate 0 needs at least 3 runs.");
    process.exit(1);
  }
  try {
    const info = await stat(clipPath);
    if (!info.isFile() || info.size <= 0) throw new Error("empty");
    await readFile(clipPath);
  } catch {
    console.error("Clip path must be a local file. Nothing was fetched.");
    process.exit(1);
  }
  const result = await runGate0({ clipPath, runs });
  console.log(result.text);
  process.exit(result.exitCode);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main();
}
