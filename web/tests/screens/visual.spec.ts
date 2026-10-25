// Visual-regression baselines for screens whose content is fixed (no random deals, no dates).
// Baselines are per platform (tests/screens/baselines/*-win32.png); refresh them with
// `npx playwright test -c playwright.screens.config.ts --project visual --update-snapshots`
// after an intended visual change.
import { expect, test } from '@playwright/test';
import { open } from '../e2e/helpers';

for (const theme of ['dark', 'light'] as const) {
  test(`visual: play table (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, '/#/play');
    await expect(page.getByTestId('poker-table')).toHaveScreenshot(`play-table-${theme}.png`);
  });

  test(`visual: lesson header and callout (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, '/#/learn/2.3');
    await expect(page.getByTestId('objectives')).toHaveScreenshot(`lesson-objectives-${theme}.png`);
    await expect(page.getByTestId('callout-key')).toHaveScreenshot(`lesson-callout-${theme}.png`);
  });

  test(`visual: settings display section (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await open(page, '/#/settings');
    await expect(page.getByTestId('settings-display')).toHaveScreenshot(`settings-display-${theme}.png`);
  });
}
