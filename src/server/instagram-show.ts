import { IG_BAD_URL, IG_FAIL } from "@/src/instagram/copy";
import { parsePublicInstagramUrl } from "@/src/instagram/url";
import { guardMetaRoute } from "./meta-guard";

/** Tokenless Instagram oEmbed. No access token. See the Graph API reference. */
export const IG_OEMBED_ORIGIN = "https://graph.facebook.com";
export const IG_OEMBED_PATH = "/v26.0/instagram_oembed";
const HTML_MAX = 100_000;

export interface InstagramShow {
  html: string;
  authorName: string;
  providerName: string;
  permalink: string;
}

export interface InstagramShowDeps {
  fetchImpl?: typeof fetch;
}

function cleanName(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/[—–]/g, "-").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return text.slice(0, 80) || fallback;
}

/** Official embed markup only. Scripts and foreign frames are dropped. */
export function sanitizeOembedHtml(html: string): string | null {
  if (!html || html.length > HTML_MAX) return null;
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  if (!stripped || /<script|javascript:|on\w+=/i.test(stripped)) return null;
  if (/<(iframe|object|embed|link|meta|form)\b/i.test(stripped)) return null;
  if (!/class=["'][^"']*instagram-media/i.test(stripped)) return null;
  return stripped;
}

export function instagramOembedRequestUrl(permalink: string): string {
  const target = new URL(IG_OEMBED_PATH, IG_OEMBED_ORIGIN);
  if (target.hostname !== "graph.facebook.com") {
    throw new Error("oEmbed host refused");
  }
  target.searchParams.set("url", permalink);
  target.searchParams.set("omitscript", "true");
  target.searchParams.set("maxwidth", "360");
  return target.toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function fetchInstagramShow(
  permalink: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; show: InstagramShow } | { ok: false; message: string }> {
  const requestUrl = instagramOembedRequestUrl(permalink);
  const parsed = new URL(requestUrl);
  if (parsed.hostname !== "graph.facebook.com" || parsed.hostname.includes("instagram.com")) {
    return { ok: false, message: IG_FAIL };
  }
  let response: Response;
  try {
    response = await fetchImpl(requestUrl, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json" },
    });
  } catch {
    return { ok: false, message: IG_FAIL };
  }
  if (response.status < 200 || response.status >= 300) {
    return { ok: false, message: IG_FAIL };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, message: IG_FAIL };
  }
  const record = asRecord(payload);
  const html = sanitizeOembedHtml(typeof record?.html === "string" ? record.html : "");
  if (!html) return { ok: false, message: IG_FAIL };
  return {
    ok: true,
    show: {
      html,
      authorName: cleanName(record?.author_name),
      providerName: cleanName(record?.provider_name, "Instagram"),
      permalink,
    },
  };
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

export async function handleInstagramShow(request: Request, deps: InstagramShowDeps = {}): Promise<Response> {
  const blocked = guardMetaRoute(request);
  if (blocked) return blocked;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, { ok: false, message: IG_BAD_URL });
  }
  const record = asRecord(raw);
  const permalink = parsePublicInstagramUrl(typeof record?.url === "string" ? record.url : "");
  if (!permalink) return json(400, { ok: false, message: IG_BAD_URL });
  const fetchImpl = deps.fetchImpl ?? fetch;
  const result = await fetchInstagramShow(permalink, fetchImpl);
  if (!result.ok) return json(200, { ok: false, message: result.message });
  return json(200, { ok: true, ...result.show });
}
