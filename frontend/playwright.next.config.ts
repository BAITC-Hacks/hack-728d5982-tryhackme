import { defineConfig, devices } from "@playwright/test";

const live = process.env.EKT_LIVE_TEST === "1";
const port = live ? 3081 : 3080;
const backend = "http://127.0.0.1:18766";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e",
  testMatch: live
    ? ["landing.live.spec.ts", "next.live.spec.ts"]
    : ["landing.spec.ts", "next.spec.ts"],
  outputDir: live ? "test-results/next-live" : "test-results/next-static",
  timeout: live ? 120_000 : 30_000,
  expect: { timeout: live ? 70_000 : 8_000 },
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: [
    ...(live
      ? [
          {
            command:
              "../backend/.venv/bin/uvicorn app.landing:app --app-dir ../backend --host 127.0.0.1 --port 18766",
            url: backend,
            reuseExistingServer: false,
          },
        ]
      : []),
    {
      command: `node_modules/.bin/next start -p ${port}`,
      env: { ASSISTANT_API_URL: live ? backend : "http://127.0.0.1:18767" },
      url: baseURL,
      reuseExistingServer: false,
    },
  ],
});
