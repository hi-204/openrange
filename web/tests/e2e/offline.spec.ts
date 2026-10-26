import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('works offline after the first visit: lessons, charts, the trainer and the solver WASM', async ({ page, context }) => {
  await open(page, '/#/learn');
  // The service worker installs and pre-caches the whole build, then takes control.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await page.goto('/');
  await expect(page.getByTestId('offline-status')).toContainText('Saved for offline use');

  await context.setOffline(true);
  await page.goto('/#/learn/2.3');
  await expect(page.getByTestId('lesson')).toContainText('Pot odds');
  await page.goto('/#/solve/charts');
  await expect(page.getByTestId('provenance-badge')).toContainText('Exact solver result', { timeout: 15_000 });
  await expect(page.getByRole('gridcell', { name: /^AA:/ })).toBeVisible();
  await page.goto('/#/train/preflop');
  await expect(page.getByTestId('preflop-question')).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/solve/reports');
  await expect(page.getByTestId('report-flops')).toBeVisible();
  // A full reload while offline still starts the app.
  await page.reload();
  await expect(page.getByTestId('report-flops')).toBeVisible();
});
