import { describe, expect, it } from "vitest";
import { CLIP_MAX_BYTES, decodeModelMedia } from "./model-media";

describe("bounded model media validation", () => {
  it("accepts the published raw clip byte boundary without a regex stack overflow", () => {
    const bytes = Buffer.alloc(CLIP_MAX_BYTES);
    bytes.write("ftyp", 4, "ascii");
    const decoded = decodeModelMedia(bytes.toString("base64"), "video/mp4", "video_chunk", CLIP_MAX_BYTES);
    expect(decoded.length).toBe(16 * 1024 * 1024);
  });

  it("rejects unknown runtime input kinds even with a valid image MIME", () => {
    expect(() => decodeModelMedia("/9j/4AEC/9k=", "image/jpeg", "clip" as "image", 100)).toThrow(/input kind/i);
  });
});
