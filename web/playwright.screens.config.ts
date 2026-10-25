import { defineConfig, devices } from '@playwright/test';

// Screenshots for docs/screenshots (`npm run screenshots`) and visual-regression baselines
// (`npm run test:visual`). Kept apart from the e2e suite: baselines are per platform.
const useBundled = process.env.PW_BROWSER === 'chromium' || process.platform !== 'win32';

export default defineConfig({
  testDir: 'tests/screens',
  timeout: 120_000,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/baselines/{arg}-{platform}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    ...(useBundled ? {} : { channel: 'msedge' }),
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'screenshots', testMatch: /screenshots\.spec\.ts/ },
    { name: 'visual', testMatch: /visual\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
