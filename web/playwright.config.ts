import { defineConfig } from "@playwright/test";

// Browser tests for keyboard and screen-reader operation. They run against the
// static build served by e2e/mock-api.ts (see "test:e2e" in package.json).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:54399",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "node --experimental-transform-types --no-warnings e2e/mock-api.ts",
    url: "http://localhost:54399/__test/requests",
    reuseExistingServer: false,
  },
});
