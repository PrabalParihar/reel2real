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
      'data: {"type":"response.output_text.delta","delta":"<|mask;x=0;y=0;data=1,1,!aa|>"}',
      "data: [DONE]",
    ].join("\n");
    const text = samOutputText(raw);
    expect(samMaskPresent(text)).toBe(true);
    expect(text).toContain("<|mask;");
    expect(samMaskPresent("no objects")).toBe(false);
  });

  it("logs upstream status and path without the key", () => {
    const line = samFailureLog(404, "https://api.meta.ai/v1/responses", "");
    expect(line).toBe("SAM upstream HTTP 404 POST /v1/responses code=empty");
    const model = samFailureLog(404, "https://api.meta.ai/v1/responses", '{"error":{"code":"model_not_found"}}');
    expect(model).toContain("code=model_not_found");
    expect(model).not.toContain("Bearer");
    expect(model).not.toContain("META_MODEL_API_KEY");
  });
});
