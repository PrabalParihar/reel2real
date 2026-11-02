import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_CAMERA_CONSTRAINTS, openRearCamera, REAR_CAMERA_CONSTRAINTS } from "../coach/camera";
import { createCameraAcquisition } from "./camera-acquisition";

function stream() {
  const track = { readyState: "live", stop() { this.readyState = "ended"; } };
  return { value: { getTracks: () => [track] } as unknown as MediaStream, track };
}
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => vi.useRealTimers());

describe("camera acquisition lifecycle", () => {
  it("does not open a fallback when the rear-camera failure arrives after leave", async () => {
    const camera = createCameraAcquisition();
    const rear = pending<MediaStream>();
    const calls: MediaStreamConstraints[] = [];
    const result = camera.acquire((signal) => openRearCamera((constraints) => {
      calls.push(constraints);
      return rear.promise;
    }, signal));
    camera.stop();
    await expect(result).resolves.toBeNull();

    rear.reject(new DOMException("No rear camera", "NotFoundError"));
    await rear.promise.catch(() => {});
    expect(calls).toEqual([REAR_CAMERA_CONSTRAINTS]);
  });

  it("does not open a fallback when the rear-camera failure arrives after timeout", async () => {
    vi.useFakeTimers();
    const camera = createCameraAcquisition();
    const rear = pending<MediaStream>();
    const calls: MediaStreamConstraints[] = [];
    const result = camera.acquire((signal) => openRearCamera((constraints) => {
      calls.push(constraints);
      return rear.promise;
    }, signal), { timeoutMs: 40 });
    const failure = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(40);
    await failure;

    rear.reject(new DOMException("No rear camera", "NotFoundError"));
    await rear.promise.catch(() => {});
    expect(calls).toEqual([REAR_CAMERA_CONSTRAINTS]);
  });

  it("closes a fallback which was already requested before leave", async () => {
    const camera = createCameraAcquisition();
    const fallback = pending<MediaStream>();
    const calls: MediaStreamConstraints[] = [];
    const result = camera.acquire((signal) => openRearCamera((constraints) => {
      calls.push(constraints);
      if (calls.length === 1) return Promise.reject(new DOMException("No rear camera", "NotFoundError"));
      return fallback.promise;
    }, signal));
    await Promise.resolve();
    expect(calls).toEqual([REAR_CAMERA_CONSTRAINTS, FALLBACK_CAMERA_CONSTRAINTS]);
    camera.stop();
    await expect(result).resolves.toBeNull();

    const late = stream();
    fallback.resolve(late.value);
    await fallback.promise;
    await Promise.resolve();
    expect(late.track.readyState).toBe("ended");
  });

  it("settles on leave and closes a camera which resolves after leave", async () => {
    const camera = createCameraAcquisition();
    const opening = pending<MediaStream>();
    const result = camera.acquire(() => opening.promise);
    camera.stop();
    await expect(result).resolves.toBeNull();
    const late = stream();
    opening.resolve(late.value);
    await Promise.resolve();
    expect(late.track.readyState).toBe("ended");
  });

  it("only publishes the latest stream and closes the prior live stream", async () => {
    const camera = createCameraAcquisition();
    const opening = pending<MediaStream>();
    const obsolete = camera.acquire(() => opening.promise);
    const current = stream();
    await expect(camera.acquire(async () => current.value)).resolves.toBe(current.value);
    await expect(obsolete).resolves.toBeNull();
    const late = stream();
    opening.resolve(late.value);
    await Promise.resolve();
    expect(late.track.readyState).toBe("ended");
    camera.stop();
    expect(current.track.readyState).toBe("ended");
  });

  it("bounds permission waits and closes late grants after timeout", async () => {
    vi.useFakeTimers();
    const camera = createCameraAcquisition();
    const opening = pending<MediaStream>();
    const result = camera.acquire(() => opening.promise, { timeoutMs: 40 });
    const failure = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(40);
    await failure;
    const late = stream();
    opening.resolve(late.value);
    await Promise.resolve();
    expect(late.track.readyState).toBe("ended");
  });
});
