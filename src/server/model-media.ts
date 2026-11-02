export const CLIP_MAX_BYTES = 16 * 1024 * 1024;
export const CLIP_MAX_DURATION_SEC = 120;
// Leaves room for base64 and metadata inside the segment route's 8 MiB JSON body.
export const SEGMENT_MAX_BYTES = 5 * 1024 * 1024;

export function decodeModelMedia(base64: string, mime: string, kind: "image" | "video_chunk", maxBytes: number): Buffer {
  if (kind !== "image" && kind !== "video_chunk") throw new Error("Unsupported media input kind.");
  if (!base64 || base64.length > Math.ceil(maxBytes / 3) * 4 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error("Media must be valid base64 within the supported byte limit.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > maxBytes) throw new Error("Media exceeds the supported byte limit.");
  if (bytes.toString("base64") !== base64) throw new Error("Media must use canonical base64 encoding.");
  const allowed = kind === "video_chunk" ? ["video/mp4", "video/webm"] : ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(mime)) throw new Error("MIME type does not match the media input kind.");
  const matches = mime === "video/mp4" ? bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp"
    : mime === "video/webm" ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!matches) throw new Error("Media container signature does not match its MIME type.");
  return bytes;
}

export function validateClipDuration(durationSec: number | undefined): asserts durationSec is number {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0 || durationSec > CLIP_MAX_DURATION_SEC) {
    throw new Error(`Clip duration must be greater than zero and at most ${CLIP_MAX_DURATION_SEC} seconds.`);
  }
}
