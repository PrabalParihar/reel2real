import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IG_BAD_URL, IG_FAIL } from "@/src/instagram/copy";
import { POST } from "../../app/api/instagram-show/route";
import { instagramOembedRequestUrl, sanitizeOembedHtml } from "./instagram-show";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PERMALINK = "https://www.instagram.com/reel/AbC12_x/";
const HTML = `<blockquote class="instagram-media" data-instgrm-permalink="${PERMALINK}"><a href="${PERMALINK}">View this post on Instagram</a></blockquote>`;

function request(body: unknown, ip: string) {
  return new Request("http://local/api/instagram-show", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("Instagram show", () => {
  it("asks Graph oEmbed and never fetches instagram.com", async () => {
    const calls: Array<{ url: string; redirect?: RequestRedirect }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, redirect: init?.redirect });
      const target = new URL(url);
      expect(target.hostname).toBe("graph.facebook.com");
      expect(target.hostname).not.toContain("instagram.com");
      expect(target.pathname).toBe("/v26.0/instagram_oembed");
      expect(target.searchParams.get("url")).toBe(PERMALINK);
      expect(target.searchParams.has("access_token")).toBe(false);
      expect(init?.method).toBe("GET");
      expect(init?.redirect).toBe("manual");
      return new Response(JSON.stringify({
        html: `${HTML}<script src="https://www.instagram.com/embed.js"></script>`,
        author_name: "Ada Cook",
        provider_name: "Instagram",
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchImpl);
    const response = await POST(request({ url: "https://instagram.com/reel/AbC12_x/?igsh=1" }, "198.51.100.40"));
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; html?: string; authorName?: string; providerName?: string };
    expect(body.ok).toBe(true);
    expect(body.authorName).toBe("Ada Cook");
    expect(body.providerName).toBe("Instagram");
    expect(body.html).toContain("instagram-media");
    expect(body.html).not.toContain("<script");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toMatch(/^https?:\/\/([^/]*\.)?instagram\.com/i);
    const source = readFileSync("src/server/instagram-show.ts", "utf8");
    expect(source).not.toMatch(/fetch\(\s*[`'"]https?:\/\/(www\.)?instagram\.com/);
    expect(source).not.toMatch(/cdninstagram|savefrom|sssinstagram|snapinsta|access_token/i);
    const built = new URL(instagramOembedRequestUrl(PERMALINK));
    expect(built.hostname).toBe("graph.facebook.com");
    expect(built.hostname).not.toBe("instagram.com");
  });

  it("does not fetch when the link is not a public post", async () => {
    const fetchImpl = vi.fn();
    const { handleInstagramShow } = await import("./instagram-show");
    const response = await handleInstagramShow(request({ url: "https://example.com/reel/AbC12_x/" }, "198.51.100.41"), { fetchImpl });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe(IG_BAD_URL);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed for a private, age-gated, or embed-disabled post", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(new URL(String(input)).hostname).not.toContain("instagram.com");
      return new Response(JSON.stringify({ error: { message: "denied" } }), { status: 400 });
    });
    const { handleInstagramShow } = await import("./instagram-show");
    const response = await handleInstagramShow(request({ url: PERMALINK }, "198.51.100.42"), { fetchImpl });
    expect(response.status).toBe(200);
    const body = await response.json() as { ok?: boolean; message?: string; html?: string };
    expect(body.ok).toBe(false);
    expect(body.message).toBe(IG_FAIL);
    expect(body.html).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("drops script and iframe markup from oEmbed html", () => {
    expect(sanitizeOembedHtml(`${HTML}<script>alert(1)</script>`)).not.toContain("script");
    expect(sanitizeOembedHtml(`<iframe src="https://www.instagram.com/reel/AbC12_x/"></iframe>`)).toBeNull();
    expect(sanitizeOembedHtml("<p>no embed</p>")).toBeNull();
  });
});
