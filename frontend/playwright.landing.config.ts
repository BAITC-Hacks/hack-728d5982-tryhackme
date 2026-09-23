import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "landing.spec.ts",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:8765", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "python3 -m http.server 8765 --bind 127.0.0.1 --directory ..",
    url: "http://127.0.0.1:8765",
    reuseExistingServer: true,
  },
});
