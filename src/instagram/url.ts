const HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const KINDS = new Set(["reel", "p"]);

/** Public Instagram photo or Reel permalink. https only, /reel/ or /p/. */
export function parsePublicInstagramUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 300) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const kind = parts[0].toLowerCase();
  const id = parts[1];
  if (!KINDS.has(kind)) return null;
  if (!/^[A-Za-z0-9_-]{5,64}$/.test(id)) return null;
  return `https://www.instagram.com/${kind}/${id}/`;
}
