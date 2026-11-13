import { defineConfig } from "@playwright/test";

const PORT = 9001;

/**
 * Browser tests: layout, reliefs and keyboard behaviours that jsdom cannot see. They run
 * against Storybook. `PLAYWRIGHT_CHANNEL=chrome` uses the installed Chrome instead of the
 * browser downloaded by `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    viewport: { width: 1300, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `yarn storybook --ci`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
