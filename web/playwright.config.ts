import { defineConfig, devices } from '@playwright/test';

// On Windows we drive the Microsoft Edge that ships with the OS, so no browser download is
// needed (D-020). Set PW_BROWSER=chromium to use Playwright's bundled Chromium instead
// (CI does this after `npx playwright install chromium`).
const useBundled = process.env.PW_BROWSER === 'chromium' || process.platform !== 'win32';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    ...(useBundled ? {} : { channel: 'msedge' }),
  },
  // The performance budgets (D-081) run after everything else, alone: sharing the CPU with
  // parallel test workers made the start-up time vary by more than a second.
  projects: [
    { name: 'e2e', testIgnore: /perf\.spec\.ts/ },
    { name: 'perf', testMatch: /perf\.spec\.ts/, dependencies: ['e2e'] },
  ],
  // Smoke tests run against the production build, so the CSP is exercised too.
  webServer: {
    command: 'npm run build && npm run preview -- --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
