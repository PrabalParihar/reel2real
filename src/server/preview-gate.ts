/** Paths the preview password must not cover. Kept in step with middleware matcher. */
const PUBLIC_PATH = /^\/(?:_next\/static(?:\/|$)|_next\/image(?:\/|$)|samples(?:\/|$)|favicon\.ico$|icon\.svg$|robots\.txt$)/;

/**
 * Forward target. Basic auth does not apply on this exact path.
 * The route checks SAM_FORWARD_SECRET itself. Every other path stays gated.
 */
export const INTERNAL_SEGMENT_PATH = "/api/internal/segment";

export function previewPathIsGated(pathname: string): boolean {
  if (pathname === INTERNAL_SEGMENT_PATH) return false;
  return !PUBLIC_PATH.test(pathname);
}
