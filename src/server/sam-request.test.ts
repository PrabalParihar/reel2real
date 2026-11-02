import { describe, expect, it } from "vitest";
import { SAM_MODEL_ID } from "@/src/models";
import { buildSamResponsesBody, responsesUrl, samFailureLog, samMaskPresent, samOutputText, samRequestHeaders } from "./sam-request";

describe("SAM request builder", () => {
  it("matches the Gate 0 still payload", () => {
    const env = { META_API_BASE: "   " };
    const url = responsesUrl(env);
    const headers = samRequestHeaders("test-key");
    const body = buildSamResponsesBody({
      prompt: "mortar",
      imageDataUrl: "data:image/jpeg;base64,aaaa",
    });
    expect(url).toBe("https://api.meta.ai/v1/responses");
    expect(responsesUrl({})).toBe("https://api.meta.ai/v1/responses");
    expect(new URL(url).pathname).toBe("/v1/responses");
    expect(headers.Accept).toBe("text/event-stream");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(body).toEqual({
      model: SAM_MODEL_ID,
      stream: true,
      metadata: { mask_encoding: "one_bit" },
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: "mortar" },
            { type: "input_image", image_url: "data:image/jpeg;base64,aaaa" },
          ],
        },
      ],
    });
    expect(body.model).toBe("sam-3.1");
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("reads a mask token from the event stream", () => {
    const raw = [
      'data: {"type":"response.output_text.delta","delta":"<0f>0<|box;x1=1;y1=2;x2=3;y2=4;w=10;h=10|>"}',
      'data: {"type":"response.output_text.delta","delta":"<|mask;x=0;y=0;data=1,1,!!!!!&O.lVP|>"}',
      "data: [DONE]",
    ].join("\n");
    const text = samOutputText(raw);
    expect(samMaskPresent(text)).toBe(true);
    expect(text).toContain("<|mask;");
    expect(samMaskPresent("no objects")).toBe(false);
  });

  it("decodes canonical SDK masks using wire height before width", () => {
    // SDK-encoded 5×3 raster with foreground pixels at offsets 0 and 8.
    // Decoding this payload with reversed dimensions fails canonical validation.
    expect(samMaskPresent("<|mask;x=0;y=0;data=3,5,!!!!!'O1'q^!!|>")).toBe(true);
  });

  it("recognizes a canonical SDK empty mask", () => {
    // SDK-encoded 5×3 raster containing only background pixels.
    expect(samMaskPresent("<|mask;x=0;y=0;data=3,5,!!!!!&!!!!!|>")).toBe(false);
  });

  it("decodes the SDK's published lossless mask without removing its marker", () => {
    expect(samMaskPresent("<|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>")).toBe(true);
  });

  it("logs upstream status and path without the key", () => {
    const line = samFailureLog({ status: 404, url: "https://api.meta.ai/v1/responses", body: "", requestId: "req_empty" });
    expect(line).toContain("POST /v1/responses");
    expect(line).toContain("request_id=req_empty");
    expect(line).toContain("status=404");
    const model = samFailureLog({
      status: 404,
      url: "https://api.meta.ai/v1/responses",
      body: '{"error":{"type":"invalid_request_error","code":"model_not_found","message":"missing"}}',
    });
    expect(model).toContain("error_code=model_not_found");
    expect(model).not.toContain("Bearer");
    expect(model).not.toContain("META_MODEL_API_KEY");
    expect(model).not.toContain("Authorization");
  });

  it.each([
    'data: {"type":"response.output_text.delta","delta":"no objects"}\n\n',
    'data: {"type":"error","error":{"message":"failed"}}\n\ndata: [DONE]\n\n',
    'data: {"type":"response.incomplete","response":{"status":"incomplete"}}\n\n',
    'data: {not json}\n\ndata: [DONE]\n\n',
    '{"status":"failed","error":{"message":"failed"}}',
  ])("rejects failed or incomplete SAM envelopes: %s", (payload) => {
    expect(() => samOutputText(payload)).toThrow();
  });

  it("accepts explicit completed zero-mask results", () => {
    expect(samOutputText('data: {"type":"response.completed","response":{"status":"completed","output":[]}}\n\ndata: [DONE]\n\n')).toBe("");
    expect(samOutputText('{"status":"completed","output":[]}')).toBe("");
    expect(samMaskPresent("<|mask;x=0;y=0;data=1,1,!!!!!&!!!!!|>")).toBe(false);
  });

  it.each([
    "<|mask;x=0;y=0;data=garbage|>",
    "<|mask;x=0;y=0;data=0,1,!aa|>",
    "<|mask;x=0;y=0;data=1,1,!aa|>",
    "<|mask;x=0;y=0;data=1,1,~|>",
    "<|mask;x=0;y=0;data=1,1,!aa",
    "<|mask;x=0;y=0;data=1,1,!!!!!!&O.lVP|>",
  ])("rejects malformed mask encodings rather than detecting an object: %s", (text) => {
    expect(() => samMaskPresent(text)).toThrow();
  });

  it.each([
    "<|mask;x=0;y=0;data=4097,1024,!aa|>",
    "<|mask;x=0;y=0;data=9007199254740992,1,!aa|>",
  ])("rejects mask dimensions above the supported limit: %s", (text) => {
    expect(() => samMaskPresent(text)).toThrow(/dimensions exceed the supported limit/);
  });
});
