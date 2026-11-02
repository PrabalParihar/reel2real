import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("**/api/runtime", (route) => route.fulfill({ json: {
    mock: true,
    sparkModelId: "muse-spark-1.3",
    samModelId: "sam-3.1",
    capabilities: { spark: false, instruct: false, segment: false },
  } }));
});

test("lesson filters show real categories and preserve the chosen lesson", async ({ page }) => {
  await page.goto("/");
  const lessons = page.locator("#demos .lesson-card");
  await expect(lessons).toHaveCount(5);
  await page.getByRole("button", { name: /^Kitchen/ }).click();
  await expect(page.getByRole("button", { name: /^Kitchen/ })).toHaveAttribute("aria-pressed", "true");
  await expect(lessons).toHaveCount(2);
  await expect(page.locator('#demos a[href="/extracting?demo=origami"]')).toHaveCount(0);
  await page.getByRole("button", { name: /^Make & grow/ }).click();
  await expect(lessons).toHaveCount(3);
  await expect(page.getByText("Grown-up supervision", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^All lessons/ }).click();
  await expect(lessons).toHaveCount(5);
  await page.getByRole("button", { name: /^Kitchen/ }).click();
  await page.locator('#demos a[href="/extracting?demo=latte-art"]').first().click();
  await expect(page).toHaveURL(/\/coach$/);
  await expect(page.getByRole("heading", { name: "Start the pour", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "franklandgrave", exact: true })).toBeVisible();
});

test("mobile discovery keeps clip and goal entry accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator('a[href="/upload"]:visible').first().click();
  await expect(page.getByRole("heading", { name: "Choose your tutorial", exact: true })).toBeVisible();
  await expect(page.locator(".sample-grid .sample-card")).toHaveCount(5);
  await page.goto("/");
  await page.locator('a[href="/instruct"]:visible').first().click();
  await expect(page.getByRole("button", { name: "Allow camera", exact: true })).toBeDisabled();
  await expect(page.locator('a[href="/extracting?demo=masala-chai"]:visible').first()).toBeVisible();
});

test("lesson counts remain readable in selected and unselected filters", async ({ page }) => {
  await page.goto("/");
  const filters = page.locator(".discovery-filters");
  const counts = filters.locator("button > span");
  await expect(counts).toHaveCount(3);
  for (const selected of [/^All lessons/, /^Kitchen/]) {
    const button = page.getByRole("button", { name: selected });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(async () => {
      // Inherited count color can settle a frame after its button background.
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      const animating = await filters.evaluate((element) => {
        for (const button of element.querySelectorAll("button")) void getComputedStyle(button).backgroundColor;
        return element.getAnimations({ subtree: true }).some((animation) => animation.pending || animation.playState === "running");
      });
      expect(animating).toBe(false);
      const contrasts = await counts.evaluateAll((elements) => {
        const rgb = (color: string) => (color.match(/[\d.]+/g) || []).map(Number);
        const luminance = (color: number[]) => color.slice(0, 3).reduce((total, value, index) => {
          const channel = value / 255;
          return total + [0.2126, 0.7152, 0.0722][index] * (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
        }, 0);
        return elements.map((count) => {
          const style = getComputedStyle(count);
          const foreground = rgb(style.color);
          const background = rgb(getComputedStyle(count.parentElement!).backgroundColor);
          const alpha = Number(style.opacity) * (foreground[3] ?? 1);
          const rendered = foreground.slice(0, 3).map((value, index) => value * alpha + background[index] * (1 - alpha));
          const light = Math.max(luminance(rendered), luminance(background));
          const dark = Math.min(luminance(rendered), luminance(background));
          return { label: count.parentElement!.textContent, ratio: (light + 0.05) / (dark + 0.05) };
        });
      });
      for (const count of contrasts) expect(count.ratio, count.label || "Filter count").toBeGreaterThanOrEqual(4.5);
    }).toPass({ timeout: 10_000 });
  }
});

for (const width of [390, 800, 1023, 1440]) {
  test(`discovery and upload keep readable content within ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Follow a tutorial on camera.", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^All lessons/ })).toBeVisible();
    await expect(page.locator("#demos .lesson-card")).toHaveCount(5);
    const landingOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(landingOverflow).toBe(false);
    const offscreenCards = await page.locator("#demos .lesson-card").evaluateAll((cards) => cards.some(card => {
      const rect = card.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1;
    }));
    expect(offscreenCards).toBe(false);
    await page.goto("/upload");
    await expect(page.getByRole("heading", { name: "Choose your tutorial", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Before you follow along", exact: true })).toBeVisible();
    await expect(page.locator(".sample-grid .sample-card")).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
