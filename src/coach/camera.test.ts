import { describe, expect, it } from "vitest";
import { cameraBlockMessage, classifyCameraError, FALLBACK_CAMERA_CONSTRAINTS, openRearCamera, REAR_CAMERA_CONSTRAINTS } from "./camera";
import { KEYFRAME_JPEG_QUALITY, KEYFRAME_LONGEST_PX, keyframeSize } from "./keyframe";

describe("rear camera", () => {
  it("prefers facingMode environment and falls back unless permission was denied", async () => {
    expect(REAR_CAMERA_CONSTRAINTS).toEqual({ audio: false, video: { facingMode: "environment" } });
    expect(FALLBACK_CAMERA_CONSTRAINTS).toEqual({ audio: false, video: true });
    const calls: MediaStreamConstraints[] = [];
    const stream = { id: "fallback" } as MediaStream;
    const opened = await openRearCamera(async (constraints) => {
      calls.push(constraints);
      if (calls.length === 1) {
        const error = new Error("no rear camera");
        error.name = "OverconstrainedError";
        throw error;
      }
      return stream;
    });
    expect(opened).toBe(stream);
    expect(calls).toEqual([REAR_CAMERA_CONSTRAINTS, FALLBACK_CAMERA_CONSTRAINTS]);

    await expect(openRearCamera(async () => {
      const error = new Error("blocked");
      error.name = "NotAllowedError";
      throw error;
    })).rejects.toMatchObject({ name: "NotAllowedError" });
  });

  it("names permission, missing camera, and insecure context", () => {
    expect(classifyCameraError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyCameraError({ name: "NotFoundError" })).toBe("missing");
    expect(classifyCameraError({ name: "TypeError" })).toBe("insecure");
    expect(cameraBlockMessage("denied")).toMatch(/permission/i);
    expect(cameraBlockMessage("missing")).toMatch(/No camera/);
    expect(cameraBlockMessage("insecure")).toMatch(/secure page/);
  });
});

describe("keyframe size", () => {
  it("scales the longest side to about 640px", () => {
    expect(KEYFRAME_LONGEST_PX).toBe(640);
    expect(KEYFRAME_JPEG_QUALITY).toBe(0.8);
    expect(keyframeSize(1920, 1080)).toEqual({ width: 640, height: 360 });
    expect(keyframeSize(1080, 1920)).toEqual({ width: 360, height: 640 });
    expect(keyframeSize(320, 240)).toEqual({ width: 320, height: 240 });
  });
});
