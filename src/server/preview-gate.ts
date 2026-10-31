/** Paths the preview password must not cover. Kept in step with middleware matcher. */
const PUBLIC_PATH = /^\/(?:_next\/static(?:\/|$)|_next\/image(?:\/|$)|samples(?:\/|$)|favicon\.ico$|icon\.svg$|robots\.txt$)/;

export function previewPathIsGated(pathname: string): boolean {
  return !PUBLIC_PATH.test(pathname);
}
