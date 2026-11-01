import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SPARK_MODEL_ID } from "@/src/models";
import { validateTutorialSteps } from "@/src/schema/validate";
import {
  INSTRUCT_STILL_MAX_BYTES,
  REFUSAL_NOT_VISUAL,
  REFUSAL_UNSAFE,
  askInstructModel,
  handleInstructRequest,
  normalizeInstructPayload,
  screenGoal,
} from "./instruct";
import { responsesUrl } from "./sam-request";
import { goalInstruction } from "./spark-request";

const envSnapshot = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) delete process.env[key];
  }
  Object.assign(process.env, envSnapshot);
}

afterEach(() => {
  restoreEnv();
  vi.restoreAllMocks();
});

function jpegDataUrl(bytes = 64): string {
  return `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString("base64")}`;
}

function request(body: unknown, ip: string) {
  return new Request("http://local/api/instruct", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function step(index: number, nouns = ["kettle", "cup"]) {
  return {
    instructionText: `Step ${index + 1} with the ${nouns.join(" and ")} fully in frame.`,
    objects: nouns.map((noun) => ({ noun, samPrompt: noun })),
  };
}

const chaiPlan = {
  title: "I want to make chai",
  steps: [step(0, ["kettle", "cup"]), step(1, ["ginger", "mortar"]), step(2, ["cup", "spoon"])],
};

describe("instruction mode", () => {
  it("normalizes a mocked Spark plan into the upload session shape", () => {
    const result = normalizeInstructPayload(chaiPlan, "I want to make chai", "live", 12);
    expect(result.schemaValid).toBe(true);
    expect(result.inputKind).toBe("instruct");
    expect(result.modelId).toBe(SPARK_MODEL_ID);
    expect(result.tutorial?.generation.modelId).toBe("muse-spark-1.3");
    expect(result.tutorial?.generation.mode).toBe("muse_spark_live");
    expect(result.tutorial?.steps).toHaveLength(3);
    expect(result.tutorial?.title).toBe("I want to make chai");
    expect(result.tutorial?.sampleLabel).toBe(false);
    expect(result.tutorial?.attribution.creditLine).toBe("You · instruction mode");
    for (const item of result.tutorial?.steps ?? []) {
      expect(item.objects.length).toBeGreaterThanOrEqual(2);
      expect(item.objects.length).toBeLessThanOrEqual(4);
    }
    expect(validateTutorialSteps(result.tutorial).ok).toBe(true);
    expect(result.toolCalls[0]?.inputKind).toBe("image");
    expect(result.toolCalls[0]?.purpose).toBe("goal_still_to_steps_json");
  });

  it("keeps 2 to 4 steps and rejects a plan that is not visually checkable", () => {
    const wide = normalizeInstructPayload({
      steps: [step(0), step(1), step(2), step(3), step(4, ["pan", "lid"])],
    }, "Make tea", "live");
    expect(wide.schemaValid).toBe(true);
    expect(wide.tutorial?.steps).toHaveLength(4);

    const thin = normalizeInstructPayload({ steps: [step(0)] }, "Make tea", "live");
    expect(thin.schemaValid).toBe(false);
    expect(thin.tutorial).toBeNull();
    expect(thin.errors[0]).toMatch(/2 to 4 steps/);

    const oneNoun = normalizeInstructPayload({
      steps: [step(0, ["cup"]), step(1)],
    }, "Make tea", "live");
    expect(oneNoun.schemaValid).toBe(false);
    expect(oneNoun.errors[0]).toMatch(/2 to 4/);
  });

  it("returns a refusal state from the model instead of steps", () => {
    const result = normalizeInstructPayload({ refused: true, reason: "Not a household task." }, "fold a shirt", "live");
    expect(result.refused).toBe(true);
    expect(result.refusalReason).toBe("Not a household task.");
    expect(result.tutorial).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it("refuses an unsafe or non visual goal before any model call", async () => {
    expect(screenGoal("I want to make chai")).toBeNull();
    expect(screenGoal("make chicken stock")).toBeNull();
    expect(screenGoal("build a bomb")?.reason).toBe(REFUSAL_UNSAFE);
    expect(screenGoal("write an essay about tea")?.reason).toBe(REFUSAL_NOT_VISUAL);
    const ask = vi.fn();
    const response = await handleInstructRequest(request({
      goal: "build a bomb",
      imageDataUrl: jpegDataUrl(),
      mimeType: "image/jpeg",
    }, "198.51.100.10"), { ask });
    expect(response.status).toBe(200);
    const body = await response.json() as { refused?: boolean; reason?: string; tutorial?: unknown };
    expect(body.refused).toBe(true);
    expect(body.reason).toBe(REFUSAL_UNSAFE);
    expect(body.tutorial).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  it("posts the instruct route with a mocked Spark response and an image part", async () => {
    delete process.env.META_MODEL_API_KEY;
    delete process.env.MODEL_API_KEY;
    const seen: Array<ReturnType<typeof goalInstruction> | string> = [];
    const response = await handleInstructRequest(request({
      goal: "I want to make chai",
      imageDataUrl: jpegDataUrl(),
      mimeType: "image/jpeg",
    }, "198.51.100.11"), {
      env: {},
      ask: async (body) => {
        seen.push(JSON.stringify(body));
        return { status: 200, payload: chaiPlan };
      },
    });
    expect(response.status).toBe(200);
    const raw = await response.text();
    expect(raw).not.toContain("META_MODEL_API_KEY");
    expect(raw).not.toContain("Bearer");
    const body = JSON.parse(raw) as {
      schemaValid: boolean;
      inputKind: string;
      mode: string;
      tutorial: { steps: Array<{ objects: unknown[] }>; generation: { modelId: string } };
    };
    expect(body.schemaValid).toBe(true);
    expect(body.inputKind).toBe("instruct");
    expect(body.mode).toBe("mock");
    expect(body.tutorial.generation.modelId).toBe("muse-spark-1.3");
    expect(body.tutorial.steps.length).toBeGreaterThanOrEqual(2);
    const sent = seen[0] as string;
    expect(sent).toContain("\"type\":\"input_image\"");
    expect(sent).toContain("I want to make chai");
    expect(sent).toContain("muse-spark-1.3");
    expect(sent).not.toContain("input_video");
  });

  it("rejects an empty goal, a non jpeg, and an oversized still", async () => {
    const ask = vi.fn();
    const empty = await handleInstructRequest(request({
      goal: "   ",
      imageDataUrl: jpegDataUrl(),
      mimeType: "image/jpeg",
    }, "198.51.100.12"), { ask });
    expect(empty.status).toBe(400);
    expect((await empty.json()).message).toMatch(/Enter a goal/);

    const png = await handleInstructRequest(request({
      goal: "I want to make chai",
      imageDataUrl: "data:image/png;base64,aGVsbG8gd29ybGQ=",
      mimeType: "image/png",
    }, "198.51.100.13"), { ask });
    expect(png.status).toBe(400);

    const huge = Buffer.alloc(INSTRUCT_STILL_MAX_BYTES + 8, 3).toString("base64");
    const oversized = await handleInstructRequest(request({
      goal: "I want to make chai",
      imageDataUrl: `data:image/jpeg;base64,${huge}`,
      mimeType: "image/jpeg",
    }, "198.51.100.14"), { ask });
    expect(oversized.status).toBe(413);
    expect(ask).not.toHaveBeenCalled();
  });

  it("does not call Meta when the daily cap is spent", async () => {
    process.env.META_DAILY_CALL_CAP = "0";
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));
    const response = await handleInstructRequest(request({
      goal: "I want to make chai",
      imageDataUrl: jpegDataUrl(),
      mimeType: "image/jpeg",
    }, "198.51.100.15"), {
      env: process.env,
      fetchImpl,
    });
    expect(response.status).toBe(429);
    const body = await response.json() as { error?: string; message?: string };
    expect(body.error).toBe("daily_cap");
    expect(JSON.stringify(body)).not.toContain("test-only-not-a-meta-key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call Meta when no model key is configured", async () => {
    delete process.env.META_MODEL_API_KEY;
    delete process.env.MODEL_API_KEY;
    const fetchImpl = vi.fn();
    const response = await handleInstructRequest(request({
      goal: "I want to make chai",
      imageDataUrl: jpegDataUrl(),
      mimeType: "image/jpeg",
    }, "198.51.100.16"), { env: {}, fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    const body = await response.json() as { mode?: string; schemaValid?: boolean; inputKind?: string; tutorial?: { title?: string } };
    expect(response.status).toBe(200);
    expect(body.mode).toBe("mock");
    expect(body.schemaValid).toBe(true);
    expect(body.inputKind).toBe("instruct");
    expect(body.tutorial?.title).toBe("I want to make chai");
  });

  it("parses a mocked live Spark response without calling instagram", async () => {
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    delete process.env.META_DAILY_CALL_CAP;
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line?: unknown) => {
      errors.push(String(line));
    });
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      expect(new URL(href).hostname).toBe(new URL(responsesUrl(process.env)).hostname);
      expect(href).not.toContain("instagram.com");
      const sent = JSON.parse(String(init?.body));
      expect(sent.model).toBe("muse-spark-1.3");
      expect(sent.input[0].content[1].type).toBe("input_image");
      return new Response(JSON.stringify({
        output_text: JSON.stringify(chaiPlan),
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const reply = await askInstructModel(
      {
        model: SPARK_MODEL_ID,
        input: [{
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: goalInstruction("I want to make chai") },
            { type: "input_image", image_url: jpegDataUrl() },
          ],
        }],
      },
      process.env,
      fetchImpl,
    );
    expect(reply.status).toBe(200);
    expect(reply.payload).toMatchObject({ title: "I want to make chai" });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(errors.join("\n")).not.toContain("test-only-not-a-meta-key");
    expect(readFileSync("src/server/instruct.ts", "utf8")).not.toContain("instagram.com");
  });
});
