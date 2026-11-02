import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { PUBLISHED_SAMPLES } from "../../src/domains/catalog";

const demos = [
  ["masala-chai", "Set out the mortar and pestle"],
  ["flask-colour", "Pour powder into the flask"],
  ["origami", "Fold the patterned paper"],
  ["seed-planting", "Poke cells in the seed tray"],
  ["latte-art", "Start the pour"],
] as const;
const clip = path.resolve("public/samples/masala-chai/hero-loop.mp4");
const tutorial = PUBLISHED_SAMPLES.find((sample) => sample.id === "masala-chai")!.tutorial;
const plan = { mode: "mock", modelId: "muse-spark-1.3", latencyMs: 1, schemaValid: true, parseOk: true, errors: [], tutorial, toolCalls: [], inputKind: "clip" };
const configuredRuntime = { mock: false, sparkModelId: "muse-spark-1.3", samModelId: "sam-3.1", capabilities: { spark: true, instruct: true, segment: false } };

test.beforeEach(async ({ page }) => {
  // Provider-independent regressions: optional web fonts are outside this suite's contract.
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
});

async function openDemo(page: Page, slug: string, first: string) {
  await page.goto(`/extracting?demo=${slug}`);
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: first, exact: true }).first()).toBeVisible();
}
async function configuredUpload(page: Page) {
  await page.route("**/api/runtime", (route) => route.fulfill({ json: configuredRuntime }));
  await page.goto("/upload");
  await page.getByLabel("Creator name (required)").fill("QA fixture");
  await page.getByRole("radio", { name: "I have permission", exact: true }).check();
  await page.locator('input[type="file"]').setInputFiles(clip);
  await page.getByRole("button", { name: "Extract steps", exact: true }).click();
}

for (const [slug, first] of demos) {
  test(`${slug}: recorded progression and replay never acquire a camera`, async ({ page }) => {
    const modelRequests: string[] = [];
    let cameraAcquisitions = 0;
    await page.exposeFunction("recordCameraAcquisition", () => { cameraAcquisitions++; });
    await page.addInitScript(() => {
      if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
        await (window as unknown as { recordCameraAcquisition: () => Promise<void> }).recordCameraAcquisition();
        throw new Error("Recorded samples must not acquire a camera");
      };
    });
    page.on("request", (request) => { if (/\/api\/(segment|instruct)$/.test(request.url())) modelRequests.push(request.url()); });
    await openDemo(page, slug, first);
    for (let step = 2; step <= 3; step++) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByRole("button", { name: `Go to step ${step}`, exact: true })).toHaveAttribute("aria-current", "step");
    }
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/\/done$/);
    await expect(page.locator(".recap-reel li")).toHaveCount(3);
    await expect(page.locator(".recap-reel li > span")).toHaveText(["You confirmed", "You confirmed", "You confirmed"]);
    await page.getByRole("link", { name: "Run again", exact: true }).click();
    await expect(page.getByRole("button", { name: "Go to step 1", exact: true })).toHaveAttribute("aria-current", "step");
    expect(modelRequests).toEqual([]);
    expect(cameraAcquisitions).toBe(0);
  });
}

test("same-tab selection opens the requested lesson with original media and credit", async ({ page }) => {
  await openDemo(page, "masala-chai", demos[0][1]);
  await page.getByRole("link", { name: "Reel2Real", exact: true }).click();
  await page.locator('a[href="/extracting?demo=latte-art"]').first().click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: "Start the pour", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "franklandgrave", exact: true })).toBeVisible();
  await expect(page.locator('.stage-wrap svg image').first()).toHaveAttribute("href", /latte-art/);
});

test("jumping ahead leaves earlier steps Unvisited", async ({ page }) => {
  await openDemo(page, "masala-chai", demos[0][1]);
  await page.getByRole("button", { name: "Go to step 3", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/done$/);
  await expect(page.locator(".recap-reel li > span")).toHaveText(["Unvisited", "Unvisited", "You confirmed"]);
});

test("mobile flask keeps its supervision, instructions and ordinary controls", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page, "flask-colour", demos[1][1]);
  await expect(page.getByText("Grown-up supervision", { exact: true })).toBeVisible();
  await expect(page.getByText(/Tilt the white bottle and pour/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: "Go to step 2", exact: true })).toHaveAttribute("aria-current", "step");
  await page.screenshot({ path: info.outputPath("flask-mobile.png"), fullPage: true });
});

test("cold completion is an honest recovery screen", async ({ page }) => {
  await page.goto("/done");
  await expect(page.getByRole("heading", { name: "No completed session", exact: true })).toBeVisible();
  await expect(page.getByText("Session complete", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Choose a lesson", exact: true })).toBeVisible();
});

test("live-off recovery opens the selected recorded sample without uploading again", async ({ page }) => {
  await page.route("**/api/spark", async (route) => {
    const body = route.request().postDataJSON();
    if (body.videoBase64) await route.fulfill({ json: { ...plan, mode: "degraded", modelId: null, tutorial: null, schemaValid: false, parseOk: false } });
    else await route.continue();
  });
  await configuredUpload(page);
  await expect(page.getByRole("heading", { name: "Live coaching is off right now.", exact: true })).toBeVisible();
  await page.locator('a[href="/extracting?demo=latte-art"]').click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: "Start the pour", exact: true }).first()).toBeVisible();
});

test("bad successful JSON gives bounded retry with retained inputs", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/spark", (route) => {
    attempts++;
    return attempts === 1 ? route.fulfill({ body: "<html>bad gateway</html>", contentType: "text/html" }) : route.fulfill({ json: plan });
  });
  await configuredUpload(page);
  await expect(page.getByRole("heading", { name: "Could not prepare steps", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry preparation", exact: true }).click();
  await expect(page).toHaveURL(/\/coach$/);
  expect(attempts).toBe(2);
});

test("blocked IndexedDB cannot prevent a valid plan from opening", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { get() { throw new DOMException("Blocked", "SecurityError"); } }));
  await page.route("**/api/spark", (route) => route.fulfill({ json: plan }));
  await configuredUpload(page);
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByText("Steps are ready. This browser could not save them for reuse.", { exact: true })).toBeVisible();
  await expect(page.locator(".app-bar")).not.toContainText("Live");
});

test("daily cap offers an explicit sample and preserves actual sample credit", async ({ page }) => {
  await page.route("**/api/spark", (route) => route.request().postDataJSON().videoBase64 ? route.fulfill({ status: 429, json: { error: "daily_cap", message: "Test cap reached" } }) : route.continue());
  await configuredUpload(page);
  await expect(page.getByRole("heading", { name: "Today's model limit is reached", exact: true })).toBeVisible();
  await page.locator('a[href="/extracting?demo=latte-art"]').click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("link", { name: "franklandgrave", exact: true })).toBeVisible();
  await expect(page.locator(".credit")).not.toContainText("QA fixture");
});

test("unavailable runtime does not ask for a camera or enable upload", async ({ page }) => {
  await page.route("**/api/runtime", (route) => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.goto("/upload");
  await page.locator(".upload-form-details > summary").click();
  await expect(page.getByRole("button", { name: "Extract steps", exact: true })).toBeDisabled();
  await page.goto("/instruct");
  await expect(page.getByRole("button", { name: "Allow camera", exact: true })).toBeDisabled();
});

test("instruction rejects a claimed-valid malformed plan and can retry with its still retained", async ({ page }) => {
  await page.route("**/api/runtime", (route) => route.fulfill({ json: configuredRuntime }));
  await page.addInitScript(() => {
    // Synthetic device input exercises the browser capture flow, not a real camera/model.
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#ded6c0"; context.fillRect(0, 0, 640, 480);
      return canvas.captureStream(5);
    };
  });
  let attempts = 0;
  await page.route("**/api/instruct", (route) => {
    attempts++;
    return route.fulfill({ json: { ...plan, inputKind: "instruct", tutorial: attempts === 1 ? { title: "Malformed" } : tutorial } });
  });
  await page.goto("/instruct");
  await page.getByRole("button", { name: "Fold an origami crane", exact: true }).click();
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState)).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Capture still", exact: true }).click();
  await page.getByRole("button", { name: "Plan steps", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan did not start", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Captured workspace still", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/coach$/);
  expect(attempts).toBe(2);
});

test("a camera check can be retried on the same step and voice can be muted", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
      canvas.getContext("2d")!.fillRect(0, 0, 640, 480);
      return canvas.captureStream(5);
    };
  });
  await page.route("**/api/spark", (route) => route.fulfill({ json: plan }));
  let checks = 0;
  await page.route("**/api/segment", (route) => {
    checks++;
    const body = route.request().postDataJSON();
    return route.fulfill({ json: { mode: "mock", modelId: "sam-3.1", latencyMs: 1, ok: true, timedOut: false, inputKind: "image", masks: body.prompts.map((prompt: { objectId: string; noun: string }) => ({ ...prompt, present: checks > 1, box: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 } })), toolCall: { tool: "sam_3_1", modelId: "sam-3.1", purpose: "keyframe_object_masks", inputKind: "image", latencyMs: 1 } } });
  });
  await configuredUpload(page);
  await expect(page).toHaveURL(/\/coach$/);
  await expect.poll(() => checks).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "Recheck objects", exact: true }).click();
  await expect.poll(() => checks).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".step-card .step-meta")).toHaveText("Step 1 of 3");
  const mute = page.getByRole("button", { name: "Voice on", exact: true });
  await mute.click();
  await expect(page.getByRole("button", { name: "Voice off", exact: true })).toHaveAttribute("aria-pressed", "false");
});
