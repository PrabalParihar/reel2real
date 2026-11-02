import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMockSegmentationClient, createMockSparkClient } from "@/src/server/mock";
import type { ModelClients, SegmentRequest, SparkRequest } from "@/src/server/types";
import { runGate0 } from "./gate0";

describe("Gate 0 local evidence harness", () => {
  it("sends actual clip bytes, duration, MIME and explicit attribution, and labels full-call timing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "reel2real-gate-test-"));
    try {
      const clipPath = path.join(dir, "fixture.webm");
      expect(spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=duration=1:size=32x32:rate=2", "-c:v", "libvpx", clipPath]).status).toBe(0);
      const bytes = await readFile(clipPath);
      const spark = createMockSparkClient({ delayMs: 0 });
      const segmentation = createMockSegmentationClient();
      const sparkInputs: SparkRequest[] = [];
      const samInputs: SegmentRequest[] = [];
      const clients: ModelClients = {
        mode: "mock", liveModeDefault: "keyframe_still",
        spark: { ...spark, async generateSteps(input) { sparkInputs.push(input); return spark.generateSteps(input); } },
        segmentation: { ...segmentation, async segment(input) { samInputs.push(input); return segmentation.segment(input); } },
      };
      const result = await runGate0({ clipPath, runs: 1, clients, creatorName: "Synthetic fixture author", licenceChoice: "self_filmed" });
      expect(sparkInputs).toHaveLength(1);
      expect(sparkInputs[0]).toMatchObject({ videoBase64: bytes.toString("base64"), mimeType: "video/webm", durationSec: 1, creatorName: "Synthetic fixture author", licenceChoice: "self_filmed" });
      expect(samInputs[0]).toMatchObject({ inputKind: "video_chunk", mediaBase64: bytes.toString("base64"), mimeType: "video/webm" });
      expect(result.text).toContain("unverified_mock");
      expect(result.text).toContain("sam_clip_full_ms");
      expect(result.text).toContain("First streamed mask: not measured");
      expect(result.text).not.toMatch(/ttfm|time to first mask|922|2213/i);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
