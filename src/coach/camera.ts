/** Prefer the rear camera. A plain facingMode is ideal, not exact. */
export const REAR_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: "environment" },
};

export const FALLBACK_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: true,
};

export type CameraBlock = "insecure" | "denied" | "missing";

export function classifyCameraError(error: unknown): CameraBlock {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "missing";
  if (name === "TypeError" || name === "InsecureContext") return "insecure";
  return "missing";
}

export function shouldPollSam(phase: "starting" | "live" | "mock" | CameraBlock): boolean {
  return phase === "live" || phase === "mock";
}

export function cameraBlockMessage(block: CameraBlock): string {
  if (block === "denied") return "Camera permission is blocked. Press Next to move the step.";
  if (block === "insecure") return "Camera needs a secure page (https). Press Next to move the step.";
  return "No camera found. Press Next to move the step.";
}

export async function openRearCamera(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  signal?: AbortSignal,
): Promise<MediaStream> {
  signal?.throwIfAborted();
  try {
    return await getUserMedia(REAR_CAMERA_CONSTRAINTS);
  } catch (error) {
    signal?.throwIfAborted();
    if (classifyCameraError(error) === "denied") throw error;
    return getUserMedia(FALLBACK_CAMERA_CONSTRAINTS);
  }
}
