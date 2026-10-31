import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Duration from the mvhd box. Used when ffprobe is not on PATH. */
export function readMvhdDuration(buffer: Buffer): number {
  const offset = buffer.indexOf(Buffer.from("mvhd"));
  if (offset < 0) throw new Error("mp4 mvhd box missing");
  const version = buffer[offset + 4];
  const timescale = version === 1 ? buffer.readUInt32BE(offset + 24) : buffer.readUInt32BE(offset + 16);
  const duration = version === 1
    ? Number(buffer.readBigUInt64BE(offset + 28))
    : buffer.readUInt32BE(offset + 20);
  if (!timescale) throw new Error("mp4 timescale is 0");
  return duration / timescale;
}

/** Real length of a loop file. ffprobe when it is installed, otherwise the mvhd box. */
export function readLoopDuration(file: string): number {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
      { encoding: "utf8" },
    ).trim();
    const value = Number(out);
    if (Number.isFinite(value) && value > 0) return value;
  } catch {
    // CI images may not ship ffprobe.
  }
  return readMvhdDuration(readFileSync(file));
}
