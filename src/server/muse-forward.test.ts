import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as instructGet, POST as internalInstruct } from "../../app/api/internal/instruct/route";
import { GET as sparkGet, POST as internalSpark } from "../../app/api/internal/spark/route";
import { POST as instructPost } from "../../app/api/instruct/route";
import { POST as sparkPost } from "../../app/api/spark/route";
import { SAM_FORWARD_SECRET_HEADER } from "./sam-forward";
import { MUSE_MAX_BODY_BYTES, museForwardEnabled, museForwardUrl } from "./muse-forward";

const SECRET = "test-forward-secret";
const SAM_URL = "http://web-preview.railway.internal:8080/api/internal/segment";
const INSTRUCT_URL = "http://web-preview.railway.internal:8080/api/internal/instruct";
const SPARK_URL = "http://web-preview.railway.internal:8080/api/internal/spark";

const envSnapshot = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
}

function clearForwardEnv() {
  delete process.env.MUSE_FORWARD_ENABLED;
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

function jpegDataUrl(): string {
  return `data:image/jpeg;base64,${Buffer.alloc(64, 7).toString("base64")}`;
}

function instructBody() {
  return JSON.stringify({
    goal: "I want to make chai",
    imageDataUrl: jpegDataUrl(),
    mimeType: "image/jpeg",
  });
}

function post(url: string, body: string, headers: Record<string, string> = {}, ip = "198.51.100.80") {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...headers,
    },
    body,
  });
}

describe("Muse forward flag", () => {
  it("stays off unless the flag is 1, the segment URL is set, and the secret is set", () => {
    expect(museForwardEnabled({})).toBe(false);
    expect(museForwardEnabled({ MUSE_FORWARD_ENABLED: "1", SAM_FORWARD_URL: SAM_URL })).toBe(false);
    expect(museForwardEnabled({ MUSE_FORWARD_ENABLED: "1", SAM_FORWARD_SECRET: SECRET })).toBe(false);
    expect(museForwardEnabled({ MUSE_FORWARD_ENABLED: "true", SAM_FORWARD_URL: SAM_URL, SAM_FORWARD_SECRET: SECRET })).toBe(false);
    expect(museForwardEnabled({ MUSE_FORWARD_ENABLED: "1", SAM_FORWARD_URL: "http://worker.internal/other", SAM_FORWARD_SECRET: SECRET })).toBe(false);
    expect(museForwardEnabled({ MUSE_FORWARD_ENABLED: "1", SAM_FORWARD_URL: SAM_URL, SAM_FORWARD_SECRET: SECRET })).toBe(true);
    expect(museForwardUrl({ SAM_FORWARD_URL: SAM_URL }, "instruct")).toBe(INSTRUCT_URL);
    expect(museForwardUrl({ SAM_FORWARD_URL: `${SAM_URL}/` }, "spark")).toBe(SPARK_URL);
  });

  it("degrades public instruct and spark when the flag is off and does not reserve a call", async () => {
    process.env.SAM_FORWARD_URL = SAM_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    process.env.MUSE_FORWARD_ENABLED = "true";
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    process.env.META_DAILY_CALL_CAP = "0";
    const fetchMock = vi.fn(async () => {
      throw new Error("public route must not call Meta");
    });
    vi.stubGlobal("fetch", fetchMock);
    const instruct = await instructPost(post("http://local/api/instruct", instructBody(), {}, "198.51.100.81"));
    expect(instruct.status).toBe(200);
    const instructBodyJson = await instruct.json() as { error?: string; errors?: string[]; schemaValid?: boolean; tutorial?: unknown; mode?: string; modelId?: string | null };
    expect(instructBodyJson.error).toBeUndefined();
    expect(instructBodyJson.schemaValid).toBe(false);
    expect(instructBodyJson.tutorial).toBeNull();
    expect(instructBodyJson.mode).toBe("degraded");
    expect(instructBodyJson.modelId).toBeNull();
    expect(instructBodyJson.errors).toEqual([]);
    const spark = await sparkPost(post("http://local/api/spark", JSON.stringify({
      transcript: "Crush the ginger.",
      creatorName: "You",
      licenceChoice: "self_filmed",
    }), {}, "198.51.100.181"));
    expect(spark.status).toBe(200);
    const sparkBody = await spark.json() as { error?: string; errors?: string[]; mode?: string; modelId?: string | null };
    expect(sparkBody.error).toBeUndefined();
    expect(sparkBody.mode).toBe("degraded");
    expect(sparkBody.modelId).toBeNull();
    expect(sparkBody.errors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards instruct with the secret header and passes the response through", async () => {
    process.env.MUSE_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = SAM_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const upstream = { schemaValid: true, inputKind: "instruct", tutorial: { title: "chai" }, from: "web-preview" };
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(INSTRUCT_URL);
      expect(url).not.toContain("api.meta.ai");
      expect(init.method).toBe("POST");
      expect(init.redirect).toBe("manual");
      const headers = init.headers as Record<string, string>;
      expect(headers[SAM_FORWARD_SECRET_HEADER]).toBe(SECRET);
      expect(headers.authorization).toBeUndefined();
      expect(headers["x-forwarded-for"]).toBe("198.51.100.82");
      const sent = JSON.parse(String(init.body));
      expect(sent.goal).toBe("I want to make chai");
      expect(sent.mimeType).toBe("image/jpeg");
      return new Response(JSON.stringify(upstream), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await instructPost(post("http://local/api/instruct", instructBody(), {}, "198.51.100.82"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(await response.json()).toEqual(upstream);
  });

  it("forwards spark with the secret header and passes the response through", async () => {
    process.env.MUSE_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = SAM_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const raw = JSON.stringify({ transcript: "Crush the ginger.", creatorName: "You", licenceChoice: "self_filmed" });
    const upstream = { schemaValid: true, inputKind: "transcript", from: "web-preview" };
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(SPARK_URL);
      expect(init.body).toBe(raw);
      const headers = init.headers as Record<string, string>;
      expect(headers[SAM_FORWARD_SECRET_HEADER]).toBe(SECRET);
      expect(headers.authorization).toBeUndefined();
      return new Response(JSON.stringify(upstream), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await sparkPost(post("http://local/api/spark", raw, {}, "198.51.100.83"));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(await response.json()).toEqual(upstream);
  });

  it("does not forward an unsafe instruct goal", async () => {
    process.env.MUSE_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = SAM_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const response = await instructPost(post("http://local/api/instruct", JSON.stringify({
      goal: "build a bomb",
      imageDataUrl: jpegDataUrl(),
      mimeType: "image/jpeg",
    }), {}, "198.51.100.84"));
    expect(response.status).toBe(200);
    expect((await response.json()).refused).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops on the daily cap before forwarding", async () => {
    process.env.MUSE_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = SAM_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    process.env.META_DAILY_CALL_CAP = "0";
    const response = await instructPost(post("http://local/api/instruct", instructBody(), {}, "198.51.100.85"));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("daily_cap");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not log the secret when the forward fails", async () => {
    process.env.MUSE_FORWARD_ENABLED = "1";
    process.env.SAM_FORWARD_URL = SAM_URL;
    process.env.SAM_FORWARD_SECRET = SECRET;
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((message: unknown) => {
      errors.push(String(message));
    });
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error(`connect failed ${SECRET} META_MODEL_API_KEY`);
    }));
    const response = await sparkPost(post("http://local/api/spark", JSON.stringify({ transcript: "tea" }), {}, "198.51.100.86"));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("META_MODEL_API_KEY");
    expect(errors.join("\n")).toBe("Muse forward failed");
    expect(errors.join("\n")).not.toContain(SECRET);
  });
});

describe("internal Muse routes", () => {
  it("returns an empty 404 without a secret, with the wrong secret, or for the wrong method", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const missing = await internalInstruct(post("http://local/api/internal/instruct", instructBody(), {}, "198.51.100.90"));
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("");

    const wrong = await internalSpark(post("http://local/api/internal/spark", "{}", {
      [SAM_FORWARD_SECRET_HEADER]: "wrong-forward-secret",
    }, "198.51.100.91"));
    expect(wrong.status).toBe(404);
    expect(await wrong.text()).toBe("");
    expect(wrong.headers.get("www-authenticate")).toBeNull();

    delete process.env.SAM_FORWARD_SECRET;
    const unset = await internalInstruct(post("http://local/api/internal/instruct", instructBody(), {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "198.51.100.92"));
    expect(unset.status).toBe(404);
    expect(await unset.text()).toBe("");

    const method = instructGet();
    expect(method.status).toBe(404);
    expect(await method.text()).toBe("");
    expect(sparkGet().status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the Meta client from the internal instruct route when a key is set", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("api.meta.ai");
      return new Response(JSON.stringify({
        output_text: JSON.stringify({ title: "chai", steps: [] }),
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await internalInstruct(post("http://local/api/internal/instruct", instructBody(), {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "198.51.100.96"));
    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.meta.ai");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("/api/internal/");
    expect(response.status === 200 || response.status === 422).toBe(true);
  });

  it("runs the instruct handler when the secret matches and does not call Meta", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const response = await internalInstruct(post("http://local/api/internal/instruct", instructBody(), {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "198.51.100.93"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.mode).toBe("mock");
    expect(body.inputKind).toBe("instruct");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("enforces the daily cap on the worker and does not call upstream", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    process.env.META_DAILY_CALL_CAP = "0";
    const response = await internalInstruct(post("http://local/api/internal/instruct", instructBody(), {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
    }, "198.51.100.94"));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toBe("daily_cap");
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain("test-only-not-a-meta-key");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns an empty 413 for an oversized body and does not call upstream", async () => {
    process.env.SAM_FORWARD_SECRET = SECRET;
    const response = await internalSpark(post("http://local/api/internal/spark", "{}", {
      [SAM_FORWARD_SECRET_HEADER]: SECRET,
      "content-length": String(MUSE_MAX_BODY_BYTES + 1),
    }, "198.51.100.95"));
    expect(response.status).toBe(413);
    expect(await response.text()).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });
});
