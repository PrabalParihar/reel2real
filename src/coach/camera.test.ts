import { describe, expect, it } from "vitest";
import { cameraBlockMessage, classifyCameraError, FALLBACK_CAMERA_CONSTRAINTS, openRearCamera, REAR_CAMERA_CONSTRAINTS, shouldPollSam } from "./camera";
import { INSTRUCT_STILL_WIDTH, KEYFRAME_JPEG_QUALITY, KEYFRAME_LONGEST_PX, instructStillSize, keyframeSize } from "./keyframe";

describe("rear camera", () => {
  it("does not request a camera when acquisition was already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const calls: MediaStreamConstraints[] = [];
    await expect(openRearCamera(async (constraints) => {
      calls.push(constraints);
      return {} as MediaStream;
    }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toEqual([]);
  });

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
    expect(shouldPollSam("denied")).toBe(false);
    expect(shouldPollSam("missing")).toBe(false);
    expect(shouldPollSam("insecure")).toBe(false);
    expect(shouldPollSam("starting")).toBe(false);
    expect(shouldPollSam("live")).toBe(true);
    expect(shouldPollSam("mock")).toBe(true);
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

  it("downscales an instruction still to about 720px wide", () => {
    expect(INSTRUCT_STILL_WIDTH).toBe(720);
    expect(instructStillSize(1920, 1080)).toEqual({ width: 720, height: 405 });
    expect(instructStillSize(1080, 1920)).toEqual({ width: 720, height: 1280 });
    expect(instructStillSize(640, 480)).toEqual({ width: 640, height: 480 });
    expect(instructStillSize(0, 480)).toEqual({ width: 0, height: 0 });
  });
});
