/** Paths the preview password must not cover. Kept in step with middleware matcher. */
const PUBLIC_PATH = /^\/(?:_next\/static(?:\/|$)|_next\/image(?:\/|$)|samples(?:\/|$)|favicon\.ico$|icon\.svg$|robots\.txt$)/;

/**
 * Forward targets. Basic auth does not apply on these exact paths.
 * Each route checks SAM_FORWARD_SECRET itself. Every other path stays gated.
 */
export const INTERNAL_SEGMENT_PATH = "/api/internal/segment";
export const INTERNAL_INSTRUCT_PATH = "/api/internal/instruct";
export const INTERNAL_SPARK_PATH = "/api/internal/spark";

const INTERNAL_FORWARD_PATHS = new Set([
  INTERNAL_SEGMENT_PATH,
  INTERNAL_INSTRUCT_PATH,
  INTERNAL_SPARK_PATH,
]);

export function previewPathIsGated(pathname: string): boolean {
  if (INTERNAL_FORWARD_PATHS.has(pathname)) return false;
  return !PUBLIC_PATH.test(pathname);
}
