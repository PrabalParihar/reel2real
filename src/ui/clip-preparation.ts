import { sha256Hex } from "./steps-cache";

// Base64 adds one third: 16 MiB stays comfortably below the 32 MiB JSON route limit.
export const MAX_CLIP_BYTES = 16 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 120;
export interface ClipMetadata { durationSec: number; width: number; height: number }
interface Options { signal?: AbortSignal; timeoutMs?: number; inspect?: (file: File, signal: AbortSignal) => Promise<ClipMetadata>; hash?: (bytes: Uint8Array<ArrayBuffer>) => Promise<string> }

export function validateClipSelection(file: File): string | null {
  if (file.size === 0) return "This file is empty. Choose an MP4 or WebM clip.";
  if (file.size > MAX_CLIP_BYTES) return "Choose a clip of 16 MB or less.";
  if (!["video/mp4", "video/webm"].includes(file.type) && !/\.(mp4|webm)$/i.test(file.name)) return "Use an MP4 or WebM file.";
  return null;
}

function abortError(): DOMException { return new DOMException("Preparation cancelled.", "AbortError"); }

/** Decodes a real first frame; metadata alone does not establish a playable video. */
function inspectVideo(file: File, signal: AbortSignal): Promise<ClipMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      const metadata = { durationSec: video.duration, width: video.videoWidth, height: video.videoHeight };
      signal.removeEventListener("abort", cancel);
      video.onloadeddata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if (error) reject(error); else resolve(metadata);
    };
    const cancel = () => finish(abortError());
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => finish();
    video.onerror = () => finish(new Error("Cannot decode this clip. Try another MP4 or WebM."));
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) { cancel(); return; }
    video.src = url;
    video.load();
  });
}

export async function prepareClip(file: File, options: Options = {}): Promise<{ videoBase64: string; clipHash: string; mimeType: string; durationSec: number }> {
  const invalid = validateClipSelection(file);
  if (invalid) throw new Error(invalid);
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeoutMs ?? 15_000);
  const interrupted = new Promise<never>((_, reject) => {
    const stop = () => reject(timedOut ? new Error("Preparing this clip took too long. Try a shorter clip or a recorded sample.") : abortError());
    if (controller.signal.aborted) stop(); else controller.signal.addEventListener("abort", stop, { once: true });
  });
  const work = async () => {
    controller.signal.throwIfAborted();
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    controller.signal.throwIfAborted();
    const mp4 = header.length >= 12 && String.fromCharCode(...header.subarray(4, 8)) === "ftyp";
    const webm = header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
    if (!mp4 && !webm) throw new Error("This is not a valid MP4 or WebM video. Choose another file.");
    const metadata = await (options.inspect ?? inspectVideo)(file, controller.signal);
    controller.signal.throwIfAborted();
    if (!Number.isFinite(metadata.durationSec) || metadata.durationSec <= 0 || metadata.width <= 0 || metadata.height <= 0) throw new Error("Cannot decode this clip. Try another MP4 or WebM.");
    if (metadata.durationSec > MAX_CLIP_SECONDS) throw new Error("Use a clip of 2 minutes or less.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    controller.signal.throwIfAborted();
    const clipHash = await (options.hash ?? sha256Hex)(bytes);
    controller.signal.throwIfAborted();
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { videoBase64: btoa(binary), clipHash, mimeType: mp4 ? "video/mp4" : "video/webm", durationSec: metadata.durationSec };
  };
  try { return await Promise.race([work(), interrupted]); }
  finally { clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); }
}
