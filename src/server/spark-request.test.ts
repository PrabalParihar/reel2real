import { describe, expect, it } from "vitest";
import { SPARK_MODEL_ID } from "@/src/models";
import {
  CHUNK_SEC,
  DATA_URL_MAX_BYTES,
  SHORT_CLIP_MAX_SEC,
  SPARK_STEPS_INSTRUCTION,
  buildSparkResponsesBody,
  chooseSparkMediaPlan,
} from "./spark-request";

describe("Spark request builder", () => {
  it("sends a short clip as an input_video data URL", () => {
    expect(chooseSparkMediaPlan({ durationSec: 2, byteLength: 200_000 })).toBe("chunk_data_url");
    expect(SHORT_CLIP_MAX_SEC).toBe(10);
    expect(CHUNK_SEC).toBe(2);
    const body = buildSparkResponsesBody({ videoBase64: "aGVsbG8=", mimeType: "video/mp4" });
    expect(body.model).toBe(SPARK_MODEL_ID);
    expect(body.input[0].content[0]).toEqual({ type: "input_text", text: SPARK_STEPS_INSTRUCTION });
    expect(body.input[0].content[1]).toEqual({
      type: "input_video",
      video_url: "data:video/mp4;base64,aGVsbG8=",
    });
    expect(JSON.stringify(body)).not.toContain("Bearer");
    expect(JSON.stringify(body)).not.toContain("META_MODEL_API_KEY");
  });

  it("uses the files API past about 10 seconds or a large payload", () => {
    expect(chooseSparkMediaPlan({ durationSec: 10, byteLength: 1000 })).toBe("chunk_data_url");
    expect(chooseSparkMediaPlan({ durationSec: 10.1, byteLength: 1000 })).toBe("files_api");
    expect(chooseSparkMediaPlan({ durationSec: 4, byteLength: DATA_URL_MAX_BYTES + 1 })).toBe("files_api");
    const body = buildSparkResponsesBody({ fileId: "file_abc" });
    expect(body.input[0].content[1]).toEqual({ type: "input_file", file_id: "file_abc" });
    expect(JSON.stringify(body)).not.toContain("base64");
  });

  it("keeps transcript text as a fallback with no video part", () => {
    const body = buildSparkResponsesBody({ transcript: "Crush the ginger." });
    expect(body.input[0].content).toHaveLength(1);
    expect(body.input[0].content[0].type).toBe("input_text");
    expect(JSON.stringify(body)).toContain("Crush the ginger.");
    expect(JSON.stringify(body)).not.toContain("input_video");
  });

  it("does not ask the model for attribution fields", () => {
    expect(SPARK_STEPS_INSTRUCTION).not.toMatch(/attribution|creditLine|licence|creatorName|sampleLabel/);
  });
});
