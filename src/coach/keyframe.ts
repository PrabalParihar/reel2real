export const KEYFRAME_LONGEST_PX = 640;
export const KEYFRAME_JPEG_QUALITY = 0.8;

export function keyframeSize(width: number, height: number, longest = KEYFRAME_LONGEST_PX): { width: number; height: number } {
  const maxSide = Math.max(width, height);
  if (maxSide <= 0) return { width: 0, height: 0 };
  if (maxSide <= longest) return { width: Math.round(width), height: Math.round(height) };
  const scale = longest / maxSide;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** JPEG data-URL payload, without the `data:image/jpeg;base64,` prefix. */
export function grabJpeg(video: HTMLVideoElement): string | undefined {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return undefined;
  const size = keyframeSize(video.videoWidth, video.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(video, 0, 0, size.width, size.height);
  const url = canvas.toDataURL("image/jpeg", KEYFRAME_JPEG_QUALITY);
  const comma = url.indexOf(",");
  if (comma < 0 || !url.startsWith("data:image/jpeg")) return undefined;
  return url.slice(comma + 1);
}
