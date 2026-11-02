import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
  },
  webServer: {
    command: process.env.CI ? "npm run start -- --hostname 127.0.0.1 --port 3000" : "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
