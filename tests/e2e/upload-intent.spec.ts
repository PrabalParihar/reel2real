import { test, expect } from "@playwright/test";

const runtime = { mock: false, sparkModelId: "muse-spark-1.3", samModelId: "sam-3.1", capabilities: { spark: true, instruct: true, segment: false } };

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("**/api/runtime", (route) => route.fulfill({ json: runtime }));
  await page.setViewportSize({ width: 390, height: 844 });
});

test("explicit clip intent reaches the mobile upload form without scrolling past examples", async ({ page }) => {
  await page.goto("/");
  await page.locator(".discovery-actions").getByRole("link", { name: "Use my clip", exact: true }).click();
  await expect(page.getByText("Use my tutorial clip", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("Choose MP4 / WebM (required)", { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel("Creator name (required)")).toBeEnabled();
  await expect(page.getByRole("region", { name: "Use my tutorial clip", exact: true }).getByText(/Live object highlights are unavailable here/)).toBeInViewport();
});

test("explicit clip intent explains unavailable extraction at the form", async ({ page }) => {
  await page.route("**/api/runtime", (route) => route.fulfill({ json: { ...runtime, capabilities: { spark: false, instruct: false, segment: false } } }));
  await page.goto("/");
  await page.locator(".discovery-actions").getByRole("link", { name: "Use my clip", exact: true }).click();
  const form = page.getByRole("region", { name: "Use my tutorial clip", exact: true });
  await expect(form.getByText("Clip extraction is unavailable here. Try a recorded sample above.", { exact: true })).toBeInViewport();
  await form.getByText("Use my tutorial clip", { exact: true }).click();
  await expect(form.getByRole("button", { name: "Extract steps", exact: true })).toBeDisabled();
});
