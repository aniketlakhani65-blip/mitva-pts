import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Mitva PTS.
 *
 * Assumes:
 *   - DATABASE_URL is set (use a SEPARATE test database — migrations + seed are destructive)
 *   - The app can be started with `npm run dev`
 *   - The seed has been run at least once so admin@mitva.local / admin123 exists
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // server actions mutate shared state — keep serial for reliability
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },

  webServer: {
    command: "npm run dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe"
  },

  projects: [
    // Global setup project — logs in once and saves storage state.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/.auth/user.json"
      },
      dependencies: ["setup"]
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        storageState: "tests/.auth/user.json"
      },
      dependencies: ["setup"],
      // Only run the mobile-first stage flow on mobile viewport to keep CI fast
      testMatch: /stage-transition\.spec\.ts/
    }
  ]
});
