import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as internalPost } from "../../app/api/internal/segment/route";
import { POST as segmentPost } from "../../app/api/segment/route";
import { highlightsChip } from "@/src/fsm/ui";
import { META_ROUTE_LIMIT } from "./ip-limit";
import {
  forwardSamRequest,
  SAM_FORWARD_SECRET_HEADER,
  samForwardDegrade,
  samForwardEnabled,
  secretsEqual,
} from "./sam-forward";

const SECRET = "test-forward-secret";
const FORWARD_URL = "http://web-preview.railway.internal:8080/api/internal/segment";
const RAW_BODY = '{"inputKind": "image", "mediaBase64": "aaaa", "mimeType": "image/jpeg", "prompts": [{"objectId": "o1", "noun": "mortar", "samPrompt": "mortar"}, {"objectId": "o2", "noun": "pestle", "samPrompt": "pestle"}, {"objectId": "o3", "noun": "cup", "samPrompt": "cup"}, {"objectId": "o4", "noun": "ginger", "samPrompt": "ginger"}, {"objectId": "o5", "noun": "extra", "samPrompt": "extra"}], "timeoutMs": 8000}';

const envSnapshot = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
}

function clearForwardEnv() {
  delete process.env.SAM_FORWARD_ENABLED;
  delete process.env.SAM_FORWARD_URL;
  delete process.env.SAM_FORWARD_SECRET;
  delete process.env.META_MODEL_API_KEY;
  delete process.env.MODEL_API_KEY;
  delete process.env.META_DAILY_CALL_CAP;
}

beforeEach(() => {
  clearForwardEnv();
  vi.stubGlobal("fetch", vi.fn(async () => {
    throw new Error("network disabled in tests");
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreEnv();
});

function segmentRequest(body: string, headers: Record<string, string> = {}, ip = "203.0.113.10") {
  return new Request("http://local/api/segment", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...headers,
    },
    body,
  });
}

describe("forward secret", () => {
  it("compares equal secrets and rejects a different length without throwing", () => {
    expect(secretsEqual(SECRET, SECRET)).toBe(true);
    expect(secretsEqual(SECRET, "wrong-forward-secret")).toBe(false);
    expect(secretsEqual("short", SECRET)).toBe(false);
    expect(readFileSync("src/server/sam-forward.ts", "utf8")).toContain("timingSafeEqual");
  });

  it("returns an empty 404 when the header is missing", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const response = await internalPost(segmentRequest(RAW_BODY, {}, "203.0.113.21"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns an empty 404 when the header is wrong", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const response = await internalPost(segmentRequest(RAW_BODY, {
      [SAM_FORWARD_SECRET_HEADER]: "wrong-forward-secret",
    }, "203.0.113.22"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("www-authenticate")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns an empty 404 when SAM_FORWARD_SECRET is unset", async () => {
    const response = await internalPost(segmentRequest(RAW_BODY, {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "203.0.113.23"));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("runs the same segment handler when the secret matches", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const direct = await segmentPost(segmentRequest(RAW_BODY, {}, "203.0.113.24"));
    const internal = await internalPost(segmentRequest(RAW_BODY, {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "203.0.113.25"));
    expect(direct.status).toBe(200);
    expect(internal.status).toBe(200);
    const directBody = await direct.json();
    const internalBody = await internal.json();
    expect(directBody.mode).toBe("mock");
    expect(internalBody.mode).toBe("mock");
    expect(internalBody.masks).toHaveLength(4);
    expect(internalBody.masks.map((mask: { noun: string }) => mask.noun)).toEqual(
      directBody.masks.map((mask: { noun: string }) => mask.noun),
    );
    expect(internalBody.ok).toBe(directBody.ok);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("SAM forward flag", () => {
  it("stays off unless the flag is 1 and a URL is set", () => {
    expect(samForwardEnabled({})).toBe(false);
    expect(samForwardEnabled({ SAM_FORWARD_ENABLED: "1" })).toBe(false);
    expect(samForwardEnabled({ SAM_FORWARD_URL: FORWARD_URL })).toBe(false);
    expect(samForwardEnabled({ SAM_FORWARD_ENABLED: "true", SAM_FORWARD_URL: FORWARD_URL })).toBe(false);
    expect(samForwardEnabled({ SAM_FORWARD_ENABLED: "1", SAM_FORWARD_URL: "  " })).toBe(false);
    expect(samForwardEnabled({ SAM_FORWARD_ENABLED: "1", SAM_FORWARD_URL: FORWARD_URL })).toBe(true);
  });

  it("uses the direct path when the flag is off", async () => {
    process.env.SAM_FORWARD_URL = FORWARD_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const response = await segmentPost(segmentRequest(RAW_BODY, {}, "203.0.113.31"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("mock");
    expect(body.ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the identical body and passes the response through when the flag is on", async () => {
    process.env.SAM_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = FORWARD_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const upstream = {
      mode: "live",
      modelId: "sam-3.1",
      ok: true,
      timedOut: false,
      inputKind: "image",
      masks: [{ objectId: "o1", noun: "mortar", present: true }],
      from: "web-preview",
    };
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(FORWARD_URL);
      expect(init.method).toBe("POST");
      expect(init.body).toBe(RAW_BODY);
      expect(init.redirect).toBe("manual");
      const headers = init.headers as Record<string, string>;
      expect(headers[SAM_FORWARD_SECRET_HEADER]).toBe(SECRET);
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["x-forwarded-for"]).toBe("203.0.113.32");
      expect(headers.authorization).toBeUndefined();
      expect(url).not.toContain("api.meta.ai");
      return new Response(JSON.stringify(upstream), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await segmentPost(segmentRequest(RAW_BODY, {
      authorization: "Basic cHJldmlldzpzZWNyZXQ=",
    }, "203.0.113.32"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual(upstream);
  });

  it("returns the highlights-unavailable result when the forward fails", async () => {
    process.env.SAM_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = FORWARD_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error(`connect failed ${FORWARD_URL} secret ${SECRET}`);
    }));
    const response = await segmentPost(segmentRequest(RAW_BODY, {}, "203.0.113.33"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.timedOut).toBe(false);
    expect(body.masks).toEqual([]);
    expect(body.mode).toBe("live");
    expect(highlightsChip(body.error)).toBe("Highlights unavailable");
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain(FORWARD_URL);
    expect(errors.join("\n")).toBe("SAM forward failed");
    expect(errors.join("\n")).not.toContain(SECRET);
    expect(errors.join("\n")).not.toContain("META_MODEL_API_KEY");
  });

  it("returns the highlights-unavailable result when the forward times out", async () => {
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
    const response = await forwardSamRequest({
      rawBody: '{"inputKind":"video_chunk","prompts":[{"objectId":"o1","noun":"wheel","samPrompt":"wheel"}]}',
      env: { SAM_FORWARD_URL: FORWARD_URL, SAM_FORWARD_SECRET: SECRET },
      timeoutMs: 20,
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ...samForwardDegrade({ timedOut: true, inputKind: "video_chunk", latencyMs: body.latencyMs }),
    });
    expect(body.timedOut).toBe(true);
    expect(body.error).toBe("SAM timed out.");
    expect(highlightsChip(body.error)).toBe("Highlights unavailable");
    expect(errors.join("\n")).toBe("SAM forward timed out");
    expect(errors.join("\n")).not.toContain(SECRET);
  });
});

describe("internal segment limits", () => {
  it("keeps the per-IP rate limit", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const ip = "203.0.113.44";
    let lastStatus = 0;
    for (let index = 0; index < META_ROUTE_LIMIT.max + 1; index += 1) {
      const response = await internalPost(segmentRequest(RAW_BODY, {
        [SAM_FORWARD_SECRET_HEADER]: SECRET,
      }, ip));
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
    const blocked = await internalPost(segmentRequest(RAW_BODY, {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, ip));
    const body = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(body.error).toBe("rate_limit");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the daily cap and does not call Meta", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    process.env.META_DAILY_CALL_CAP = "0";
    const response = await internalPost(segmentRequest(RAW_BODY, {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "203.0.113.45"));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("daily_cap");
    expect(JSON.stringify(body)).not.toContain("test-only-not-a-meta-key");
    expect(fetch).not.toHaveBeenCalled();
  });
});
