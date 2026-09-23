import { defineConfig, devices } from "@playwright/test";

const live = process.env.EKT_LIVE_TEST === "1";
const baseURL = live ? "http://127.0.0.1:8766" : "http://127.0.0.1:8765";

export default defineConfig({
  testDir: "./e2e",
  testMatch: live ? "landing.live.spec.ts" : "landing.spec.ts",
  outputDir: live ? "test-results/landing-live" : "test-results/landing-static",
  timeout: live ? 120_000 : 30_000,
  expect: { timeout: live ? 70_000 : 5_000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: live
      ? "../backend/.venv/bin/uvicorn app.landing:app --app-dir ../backend --host 127.0.0.1 --port 8766"
      : "python3 -m http.server 8765 --bind 127.0.0.1 --directory ..",
    url: baseURL,
    reuseExistingServer: true,
  },
});
