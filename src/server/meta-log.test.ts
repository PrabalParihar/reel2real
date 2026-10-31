import { describe, expect, it } from "vitest";
import { META_USER_AGENT, metaJsonHeaders, metaUpstreamLog, parseMetaError, readUpstreamHeaders, samFailureLog, sparkFailureLog } from "./meta-log";
import { samRequestHeaders } from "./sam-request";

const secret = "sk-live-secret";
const envelope = JSON.stringify({
  error: {
    type: "invalid_request_error",
    code: "model_not_found",
    message: `The model was not found. Authorization: Bearer ${secret}`,
  },
});

describe("Meta upstream logs", () => {
  it("puts the request id on the success line and the error line", () => {
    const ok = metaUpstreamLog({
      path: "/v1/responses",
      model: "sam-3.1",
      status: 200,
      requestId: "req_ok",
      route: "sam",
      latencyMs: 42,
    });
    expect(ok).toBe("Meta upstream POST /v1/responses model=sam-3.1 status=200 request_id=req_ok route=sam latency_ms=42");

    const sam = samFailureLog({
      status: 404,
      url: "https://api.meta.ai/v1/responses",
      body: envelope,
      requestId: "req_sam",
      route: "edge",
      latencyMs: 11,
      model: "sam-3.1",
      secrets: [secret],
    });
    const spark = sparkFailureLog({
      status: 404,
      url: "https://api.meta.ai/v1/responses",
      body: envelope,
      requestId: "req_spark",
      route: "spark",
      latencyMs: 19,
      secrets: [secret],
    });
    expect(sam).toContain("request_id=req_sam");
    expect(sam).toContain("status=404");
    expect(spark).toContain("request_id=req_spark");
    expect(spark).toContain("model=muse-spark-1.3");
    for (const line of [ok, sam, spark]) {
      expect(line).not.toContain(secret);
      expect(line).not.toContain("Bearer");
      expect(line).not.toContain("Authorization");
    }
  });

  it("parses the error envelope and truncates the message", () => {
    const parsed = parseMetaError(JSON.stringify({
      error: {
        type: "invalid_request_error",
        code: "model_not_found",
        message: `${"x".repeat(250)} ${secret}`,
      },
    }), [secret]);
    expect(parsed.type).toBe("invalid_request_error");
    expect(parsed.code).toBe("model_not_found");
    expect(parsed.message.length).toBeLessThanOrEqual(200);
    expect(parsed.message).not.toContain(secret);

    const empty = samFailureLog({ status: 404, url: "https://api.meta.ai/v1/responses", body: "" });
    expect(empty).toContain("error_code=-");
    expect(empty).toContain("request_id=-");
  });

  it("reads only x-request-id and x-route", () => {
    const headers = new Headers({
      "x-request-id": "req_header",
      "x-route": "meta-route",
      Authorization: `Bearer ${secret}`,
    });
    expect(readUpstreamHeaders(headers)).toEqual({ requestId: "req_header", route: "meta-route" });
  });

  it("sets the server user agent on Meta JSON headers", () => {
    expect(META_USER_AGENT).toBe("reel2real/0.1 (+server)");
    expect(metaJsonHeaders("test-key")["User-Agent"]).toBe(META_USER_AGENT);
    expect(samRequestHeaders("test-key")["User-Agent"]).toBe(META_USER_AGENT);
    expect(samRequestHeaders("test-key").Accept).toBe("text/event-stream");
  });
});
