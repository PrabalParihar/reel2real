import { test, expect, type Page } from "@playwright/test";
import { PUBLISHED_SAMPLES } from "../../src/domains/catalog";

const runtime = { mock: false, sparkModelId: "muse-spark-1.3", samModelId: "sam-3.1", capabilities: { spark: true, instruct: true, segment: false } };
const tutorial = PUBLISHED_SAMPLES.find((sample) => sample.id === "masala-chai")!.tutorial;
type CameraOptions = { pending?: boolean; rejectPlay?: boolean; realFrames?: boolean; error?: string; enabled?: boolean };
type CameraFixture = { calls: number; stops: number; plays: number; ready: boolean; release: () => void };

async function openInstruction(page: Page, options: CameraOptions = {}) {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("**/api/runtime", (route) => route.fulfill({ json: options.enabled === false ? { ...runtime, capabilities: { spark: false, instruct: false, segment: false } } : runtime }));
  await page.route("**/api/instruct", (route) => route.fulfill({ status: 503, json: { message: "No provider calls in browser regressions" } }));
  await page.route("**/api/segment", (route) => route.fulfill({ json: { ok: false, mode: "degraded", masks: [] } }));
  await page.addInitScript((settings) => {
    const fixture: CameraFixture = { calls: 0, stops: 0, plays: 0, ready: false, release: () => {} };
    (window as unknown as { cameraFixture: CameraFixture }).cameraFixture = fixture;
    const originalPlay = HTMLMediaElement.prototype.play;
    const originalReady = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "readyState")!;
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, "videoWidth")!;
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, "videoHeight")!;
    const isPreview = (video: HTMLMediaElement) => !settings.realFrames && video.classList.contains("instruct-video");
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get() { return isPreview(this) ? fixture.ready ? 2 : 0 : originalReady.get!.call(this); } });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get() { return isPreview(this) ? fixture.ready ? 640 : 0 : originalWidth.get!.call(this); } });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get() { return isPreview(this) ? fixture.ready ? 480 : 0 : originalHeight.get!.call(this); } });
    HTMLMediaElement.prototype.play = function () {
      if (this.classList.contains("instruct-video")) {
        fixture.plays++;
        if (settings.rejectPlay) return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
        if (!settings.realFrames) return Promise.resolve();
      }
      return originalPlay.call(this);
    };
    navigator.mediaDevices.getUserMedia = async () => {
      fixture.calls++;
      if (settings.error) throw new DOMException("Synthetic camera failure", settings.error);
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      canvas.getContext("2d")!.fillRect(0, 0, 640, 480);
      const stream = canvas.captureStream(settings.realFrames ? 12 : 0);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => { fixture.stops++; stop(); };
      }
      if (settings.pending) await new Promise<void>((resolve) => { fixture.release = resolve; });
      return stream;
    };
  }, options);
  await page.goto("/instruct");
  if (options.enabled !== false) await expect(page.getByRole("button", { name: "Allow camera", exact: true })).toBeEnabled();
}

async function cameraStats(page: Page) {
  return page.evaluate(() => {
    const fixture = (window as unknown as { cameraFixture: CameraFixture }).cameraFixture;
    return { calls: fixture.calls, stops: fixture.stops, plays: fixture.plays };
  });
}

async function attachCamera(page: Page) {
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await expect.poll(() => page.locator("video.instruct-video").evaluate((video: HTMLVideoElement) => Boolean(video.srcObject))).toBe(true);
}

test("preview mounts while permission is pending and duplicate clicks do not acquire twice", async ({ page }) => {
  await openInstruction(page, { pending: true });
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await expect(page.locator("video.instruct-video")).toHaveCount(1);
  expect((await cameraStats(page)).calls).toBe(1);
  await expect(page.getByRole("button", { name: /Opening camera|Camera starting/ })).toBeDisabled();
  await page.evaluate(() => (window as unknown as { cameraFixture: CameraFixture }).cameraFixture.release());
  await expect(page.getByRole("button", { name: "Capture still", exact: true })).toBeDisabled();
});

test("Capture waits for a frame even when playback initially rejects", async ({ page }) => {
  await openInstruction(page, { rejectPlay: true });
  await attachCamera(page);
  await expect(page.getByRole("button", { name: "Capture still", exact: true })).toBeDisabled();
  await expect(page.getByRole("heading", { name: /Camera access is blocked|Camera didn't start/ })).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { cameraFixture: CameraFixture }).cameraFixture.ready = true;
    document.querySelector("video.instruct-video")!.dispatchEvent(new Event("loadeddata"));
  });
  await expect(page.getByRole("button", { name: "Capture still", exact: true })).toBeEnabled();
});

test("missing frames time out once and retry starts a fresh eight-second window", async ({ page }) => {
  await openInstruction(page, { rejectPlay: true });
  await page.clock.install({ time: new Date("2026-11-02T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-02T00:00:01Z"));
  await attachCamera(page);
  await page.clock.runFor(7_900);
  await expect(page.getByRole("heading", { name: "Camera didn't start", exact: true })).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.getByRole("heading", { name: "Camera didn't start", exact: true })).toBeVisible();
  expect((await cameraStats(page)).stops).toBe(1);
  await page.getByRole("button", { name: "Retry camera", exact: true }).click();
  await expect.poll(async () => (await cameraStats(page)).calls).toBe(2);
  await page.clock.runFor(7_900);
  await expect(page.getByRole("heading", { name: "Camera didn't start", exact: true })).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(page.getByRole("heading", { name: "Camera didn't start", exact: true })).toBeVisible();
});

test("busy camera fails immediately without a second constraint request", async ({ page }) => {
  await openInstruction(page, { error: "NotReadableError" });
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Camera is in use", exact: true })).toBeVisible();
  expect((await cameraStats(page)).calls).toBe(1);
  await expect(page.getByRole("button", { name: "Retry camera", exact: true })).toBeEnabled();
});

test("permission denial offers immediate retry and recorded recovery", async ({ page }) => {
  await openInstruction(page, { error: "NotAllowedError" });
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Camera access is blocked", exact: true })).toBeVisible();
  expect((await cameraStats(page)).calls).toBe(1);
  await expect(page.getByRole("button", { name: "Retry camera", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: /recorded sample/i }).first()).toBeVisible();
});

test("leaving during permission disposes a late stream without reopening the preview", async ({ page }) => {
  await openInstruction(page, { pending: true });
  await page.getByRole("button", { name: "Allow camera", exact: true }).click();
  await page.getByRole("link", { name: "Reel2Real", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => (window as unknown as { cameraFixture: CameraFixture }).cameraFixture.release());
  await expect.poll(async () => (await cameraStats(page)).stops).toBe(1);
  await expect(page.locator("video.instruct-video")).toHaveCount(0);
});

test("captured still survives the frame deadline and malformed-plan retry reaches coach", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openInstruction(page, { realFrames: true });
  const requests: Array<{ goal: string; imageDataUrl: string }> = [];
  await page.route("**/api/instruct", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: requests.length === 1
      ? { schemaValid: true, tutorial: { broken: true } }
      : { mode: "mock", modelId: "muse-spark-1.3", latencyMs: 1, schemaValid: true, parseOk: true, errors: [], tutorial, toolCalls: [], inputKind: "instruct" } });
  });
  await page.getByLabel("Goal (required)").fill("Make chai");
  await page.clock.install();
  await attachCamera(page);
  await page.getByRole("button", { name: "Capture still", exact: true }).click();
  await expect(page.getByRole("img", { name: "Captured workspace still", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("instruction-captured-mobile.png"), fullPage: true });
  expect((await cameraStats(page)).stops).toBe(1);
  await page.clock.runFor(8_100);
  await expect(page.getByRole("heading", { name: "Camera didn't start", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Plan steps", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Plan did not start", exact: true })).toBeVisible();
  await expect(page.getByLabel("Goal (required)")).toHaveValue("Make chai");
  await expect(page.getByRole("img", { name: "Captured workspace still", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: "Set out the mortar and pestle", exact: true }).first()).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[0].goal).toBe("Make chai");
  expect(requests[0].imageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(requests[1]).toEqual(requests[0]);
});

test("unavailable planning never acquires the camera", async ({ page }) => {
  await openInstruction(page, { enabled: false });
  await expect(page.getByText(/Camera planning is unavailable/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Allow camera", exact: true })).toBeDisabled();
  expect((await cameraStats(page)).calls).toBe(0);
});
