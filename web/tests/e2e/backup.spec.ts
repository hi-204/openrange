import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

// Backup round trip (expansion Phase 0): answers and settings survive export → delete → import.
test('backup: export, delete everything, import, and the data is back', async ({ page }) => {
  await open(page, '/#/train');
  const question = page.getByTestId('preflop-question');
  await expect(question).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 2; i++) {
    await expect(question).toContainText('Your move.');
    await page.keyboard.press('1');
    await expect(page.getByTestId('answer').getByTestId('grade')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('answer')).toHaveCount(0);
  }

  // A setting that the import must restore.
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Dark' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('link', { name: 'Stats' }).first().click();
  await expect(page.getByTestId('review-summary')).toContainText('2 answers on this device');
  await page.goto('/#/settings');
  const data = page.getByTestId('data-settings');
  const [download] = await Promise.all([page.waitForEvent('download'), data.getByRole('button', { name: 'Export as JSON' }).click()]);
  const file = await download.path();
  const backup = JSON.parse(readFileSync(file, 'utf8')) as { schema: string; answers: unknown[]; app: unknown };
  expect(backup.schema).toBe('openrange.trainer/2');
  expect(backup.answers).toHaveLength(2);
  expect(JSON.stringify(backup.app)).toContain('"theme":"dark"');

  page.once('dialog', (d) => void d.accept());
  await data.getByRole('button', { name: 'Delete all trainer data' }).click();
  await expect(data.getByRole('status')).toContainText('All trainer data deleted.');
  await page.goto('/#/stats');
  await expect(page.getByRole('heading', { name: 'Stats', level: 1 })).toBeVisible();
  await expect(page.getByText('2 answers on this device')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.goto('/#/settings');
  await page.getByTestId('data-settings').locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByTestId('data-settings').getByRole('status')).toContainText('Imported 2 answers.');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/#/stats');
  await expect(page.getByTestId('review-summary')).toContainText('2 answers on this device');
});
