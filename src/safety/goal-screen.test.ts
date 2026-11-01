import { describe, expect, it } from "vitest";
import { POST as sparkPost } from "../../app/api/spark/route";
import { executeSpark } from "@/src/server/spark-run";
import { PUBLISHED_SAMPLES } from "@/src/domains/catalog";
import {
  REFUSAL_NOT_VISUAL,
  REFUSAL_UNSAFE,
  looksLikeModelRefusal,
  modelRefusalReason,
  screenGoal,
  screenSparkInput,
} from "./goal-screen";

const REFUSE = [
  "mix bleach and ammonia",
  "how to make a bomb",
  "Do the flask colour reaction",
  "Bleach + Amonia cleaner",
  "combine drain cleaner and vinegar",
  "mix bleech and vinegar",
  "make chlorine gas",
  "synthesize meth",
  "how to make heroin",
];

const ALLOW = [
  "Make a chai spice mix",
  "Pour latte art",
  "Fold an origami crane",
  "Plant seeds in a tray",
  "mix the milk",
  "mix flour and water",
  "clean the counter with soap",
  "make chicken stock",
  "add citric acid and sugar",
];

describe("unsafe goal screen", () => {
  it("refuses dangerous goals and common misspellings", () => {
    for (const goal of REFUSE) {
      expect(screenGoal(goal)?.reason, goal).toBe(REFUSAL_UNSAFE);
    }
  });

  it("allows household goals", () => {
    for (const goal of ALLOW) {
      expect(screenGoal(goal), goal).toBeNull();
    }
    expect(screenGoal("write an essay about tea")?.reason).toBe(REFUSAL_NOT_VISUAL);
  });

  it("does not screen a sample load, including the flask tutorial", async () => {
    const flask = PUBLISHED_SAMPLES.find((sample) => sample.id === "flask-colour");
    expect(flask).toBeTruthy();
    expect(screenSparkInput({
      sampleId: flask?.id,
      title: flask?.tutorial.title,
    })).toBeNull();
    expect(flask?.tutorial.steps.some((step) => step.objects.some((object) => object.noun === "flask"))).toBe(true);
    expect(screenGoal("Do the flask colour reaction")?.reason).toBe(REFUSAL_UNSAFE);
    delete process.env.META_MODEL_API_KEY;
    delete process.env.MODEL_API_KEY;
    delete process.env.META_DAILY_CALL_CAP;
    const loaded = await executeSpark({
      sampleId: "flask-colour",
      title: flask?.tutorial.title,
      creatorName: "Alex",
      licenceChoice: "self_filmed",
    }, { mockSparkDelayMs: 0 });
    expect(loaded.status).toBe(200);
    const body = await loaded.json() as { refused?: boolean; inputKind?: string; tutorial?: { steps: Array<{ objects: Array<{ noun: string }> }> } };
    expect(body.refused).toBeUndefined();
    expect(body.inputKind).toBe("sample");
    expect(body.tutorial?.steps[0].objects.some((object) => object.noun === "flask")).toBe(true);
  });

  it("refuses an unsafe spark transcript before the daily cap", async () => {
    process.env.META_DAILY_CALL_CAP = "0";
    process.env.META_MODEL_API_KEY = "test-only-not-a-meta-key";
    const response = await sparkPost(new Request("http://local/api/spark", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.161" },
      body: JSON.stringify({
        transcript: "mix bleach and ammonia",
        creatorName: "You",
        licenceChoice: "self_filmed",
      }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { refused?: boolean; error?: string; reason?: string };
    expect(body.refused).toBe(true);
    expect(body.reason).toBe(REFUSAL_UNSAFE);
    expect(body.error).toBeUndefined();
  });

  it("treats model safety text as a refusal", () => {
    expect(looksLikeModelRefusal("I cannot assist with this request")).toBe(true);
    expect(looksLikeModelRefusal("The plan needs at least one step.")).toBe(false);
    expect(modelRefusalReason({ refused: true, reason: "Not a household task." })).toBe("Not a household task.");
    expect(modelRefusalReason({ message: "I must refuse this chemical goal" })).toBe(REFUSAL_UNSAFE);
    expect(modelRefusalReason({ errors: ["The steps JSON did not validate."] })).toBeNull();
  });
});
