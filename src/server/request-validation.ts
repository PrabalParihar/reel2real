import type { SegmentRequest, SparkRequest } from "./types";

type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response };
const record = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);
const fail = (message: string): Parsed<never> => ({ ok: false, response: Response.json({ error: "invalid_request", message }, { status: 400 }) });

export function parseSparkRequest(raw: string): Parsed<SparkRequest> {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { ok: false, response: Response.json({ error: "invalid_json", message: "The request was not JSON." }, { status: 400 }) }; }
  if (!record(body)) return fail("Expected a tutorial request object.");
  const strings = ["transcript", "title", "filename", "sampleId", "videoBase64", "mimeType", "creatorName", "licenceChoice", "creditLink", "domain"];
  for (const key of strings) if (body[key] !== undefined && typeof body[key] !== "string") return fail(`Invalid ${key}.`);
  if (body.durationSec !== undefined && (typeof body.durationSec !== "number" || !Number.isFinite(body.durationSec) || body.durationSec <= 0 || body.durationSec > 120)) return fail("Use a clip up to 120 seconds long.");
  if (body.licenceChoice !== undefined && !["self_filmed", "permission_granted"].includes(body.licenceChoice as string)) return fail("Choose a supported licence.");
  if (body.domain !== undefined && !["indian_recipe", "non_cooking_diy", "other"].includes(body.domain as string)) return fail("Choose a supported domain.");
  if (typeof body.videoBase64 === "string" && body.videoBase64.length > Math.ceil(16 * 1024 * 1024 / 3) * 4 + 128) return fail("Use a video file up to 16 MiB.");
  if (typeof body.transcript === "string" && body.transcript.length > 30_000) return fail("The transcript is too long.");
  if (typeof body.title === "string" && body.title.length > 240) return fail("Use a title up to 240 characters.");
  if (typeof body.creatorName === "string" && body.creatorName.length > 200) return fail("Use a creator name up to 200 characters.");
  // Pick known JSON fields; cancellation is supplied by the trusted route only.
  return { ok: true, value: Object.fromEntries([...strings, "durationSec"].filter((key) => body[key] !== undefined).map((key) => [key, body[key]])) as SparkRequest };
}

export function parseSegmentRequest(raw: string): Parsed<SegmentRequest> {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return { ok: false, response: Response.json({ error: "invalid_json", message: "The request was not JSON." }, { status: 400 }) }; }
  if (!record(body)) return fail("Expected a highlight request object.");
  if (body.inputKind !== undefined && body.inputKind !== "image" && body.inputKind !== "video_chunk") return fail("Unsupported media kind.");
  if (body.prompts !== undefined && !Array.isArray(body.prompts)) return fail("Prompts must be an array.");
  const prompts = (body.prompts ?? []) as unknown[];
  if (prompts.length > 64 || prompts.some((p) => !record(p) || ["objectId", "noun", "samPrompt"].some((key) => typeof p[key] !== "string" || !(p[key] as string).trim() || (p[key] as string).length > 240))) return fail("Each prompt needs an object ID, name and visual description.");
  if (body.timeoutMs !== undefined && (typeof body.timeoutMs !== "number" || !Number.isFinite(body.timeoutMs) || body.timeoutMs <= 0)) return fail("Use a positive timeout.");
  if (body.mediaBase64 !== undefined && typeof body.mediaBase64 !== "string") return fail("Invalid media bytes.");
  if (body.mimeType !== undefined && typeof body.mimeType !== "string") return fail("Invalid media type.");
  if (body.phase !== undefined && (typeof body.phase !== "number" || !Number.isFinite(body.phase))) return fail("Invalid frame phase.");
  if (body.scenario !== undefined && !["on_track", "skip", "out_of_order", "safety", "mask_lost"].includes(body.scenario as string)) return fail("Invalid mock scenario.");
  return { ok: true, value: {
    inputKind: body.inputKind === "video_chunk" ? "video_chunk" : "image",
    mediaBase64: body.mediaBase64 as string | undefined,
    mimeType: body.mimeType as string | undefined,
    prompts: prompts.slice(0, 4) as SegmentRequest["prompts"],
    timeoutMs: Math.min((body.timeoutMs as number | undefined) ?? 8000, 8000),
    scenario: body.scenario as SegmentRequest["scenario"],
    phase: body.phase as number | undefined,
  } };
}
