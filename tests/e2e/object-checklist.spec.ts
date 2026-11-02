import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { PUBLISHED_SAMPLES } from "../../src/domains/catalog";

const base = PUBLISHED_SAMPLES.find((sample) => sample.id === "masala-chai")!.tutorial;
const tutorial = {
  ...base,
  steps: base.steps.slice(0, 2).map((step, index) => ({
    ...step,
    instructionText: index ? "Prepare the paper" : "Set out the flask and bottle",
    objects: (index ? ["paper"] : ["flask", "bottle"]).map((objectId) => ({ objectId, noun: objectId, samPrompt: objectId, role: "required_present" as const })),
    successCheck: { kind: "all_required_present" as const, description: "Check object visibility", requiredObjectIds: index ? ["paper"] : ["flask", "bottle"], minStableChunks: 1 },
  })),
};

async function openLiveCoach(page: Page) {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("**/api/runtime", (route) => route.fulfill({ json: { mock: false, sparkModelId: "muse-spark-1.3", samModelId: "sam-3.1", capabilities: { spark: true, instruct: true, segment: true } } }));
  await page.route("**/api/spark", (route) => route.fulfill({ json: { mode: "live", modelId: "muse-spark-1.3", latencyMs: 1, schemaValid: true, parseOk: true, errors: [], tutorial, toolCalls: [], inputKind: "clip" } }));
  await page.addInitScript(() => {
    // Synthetic frames exercise capture; all provider endpoints are intercepted.
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ded6c0"; context.fillRect(0, 0, 640, 480);
      return canvas.captureStream(12);
    };
  });
  await page.goto("/upload");
  await page.getByLabel("Creator name (required)").fill("QA fixture");
  await page.getByRole("radio", { name: "I have permission", exact: true }).check();
  await page.locator('input[type="file"]').setInputFiles(path.resolve("public/samples/masala-chai/hero-loop.mp4"));
  await page.getByRole("button", { name: "Extract steps", exact: true }).click();
  await expect(page).toHaveURL(/\/coach$/);
}

const result = (restored: boolean) => ({
  mode: "live", modelId: "sam-3.1", latencyMs: 1, ok: true, timedOut: false, inputKind: "image",
  masks: [
    { objectId: "flask", noun: "flask", present: true },
    { objectId: "bottle", noun: "bottle", present: restored },
  ],
  toolCall: { tool: "sam_3_1", modelId: "sam-3.1", purpose: "Test fixture", inputKind: "image" },
});

test("missing object can be rechecked, and Next clears the old step evidence", async ({ page }) => {
  let restored = false;
  let releaseRecheck: (() => void) | undefined;
  await page.route("**/api/segment", async (route) => {
    const prompts: Array<{ objectId: string }> = route.request().postDataJSON().prompts;
    if (prompts[0]?.objectId === "paper") {
      await route.fulfill({ json: { ...result(false), masks: [] } });
      return;
    }
    if (restored) await new Promise<void>((resolve) => { releaseRecheck = resolve; });
    await route.fulfill({ json: result(restored) });
  });
  await openLiveCoach(page);
  const checklist = page.getByRole("region", { name: "Objects for this step", exact: true });
  await expect(checklist).toContainText("Not highlighted");
  await expect(checklist.getByRole("listitem").filter({ hasText: "flask" })).toContainText("Visible in checked frame");
  restored = true;
  await page.getByRole("button", { name: "Recheck objects", exact: true }).click();
  await expect(checklist).toContainText("Not checked");
  await expect(checklist).not.toContainText("Visible in checked frame");
  await expect.poll(() => Boolean(releaseRecheck)).toBe(true);
  releaseRecheck!();
  await expect(checklist.getByRole("listitem").filter({ hasText: "bottle" })).toContainText("Visible in checked frame");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(checklist).toContainText("paper");
  await expect(checklist).toContainText("Not checked");
  await expect(checklist).not.toContainText("flask");
  await expect(checklist).not.toContainText("Visible in checked frame");
});

test("a failed object request never becomes an absent object", async ({ page }) => {
  await page.route("**/api/segment", (route) => route.fulfill({ status: 502, json: { error: "Synthetic provider failure" } }));
  await openLiveCoach(page);
  const checklist = page.getByRole("region", { name: "Objects for this step", exact: true });
  await expect(checklist).toContainText("Check unavailable");
  await expect(checklist).not.toContainText("Not highlighted");
  await expect(checklist).not.toContainText("Visible in checked frame");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
});

test("mobile recorded filmstrip scrolls fully above the dock and remains camera-free", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  let cameraCalls = 0;
  await page.exposeFunction("unexpectedCamera", () => { cameraCalls++; });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      await (window as unknown as { unexpectedCamera: () => Promise<void> }).unexpectedCamera();
      throw new Error("Recorded lesson must remain camera-free");
    };
  });
  await page.route("**/api/segment", (route) => route.fulfill({ status: 500, json: { error: "Recorded example must not request SAM" } }));
  await page.goto("/extracting?demo=flask-colour");
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByText("Grown-up supervision", { exact: true })).toBeVisible();
  await expect(page.getByText(/Tilt the white bottle and pour/)).toBeVisible();
  const target = page.getByRole("button", { name: "Go to step 3", exact: true });
  await target.scrollIntoViewIfNeeded();
  const thumb = await target.boundingBox();
  const dock = await page.locator(".dock").boundingBox();
  expect(thumb).not.toBeNull(); expect(dock).not.toBeNull();
  expect(thumb!.y + thumb!.height).toBeLessThanOrEqual(dock!.y);
  await page.screenshot({ path: info.outputPath("mobile-filmstrip-clearance.png"), fullPage: true });
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("region", { name: "Objects for this step", exact: true })).toHaveCount(0);
  expect(cameraCalls).toBe(0);
});
