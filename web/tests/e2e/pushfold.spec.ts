import { expect, test } from '@playwright/test';

test('push/fold calculator solves an ICM bubble spot in the browser', async ({ page }) => {
  await page.goto('/#/pushfold');
  await page.getByRole('button', { name: 'Solve' }).click();
  const result = page.getByTestId('pushfold-result');
  await expect(result).toContainText('Exact for this model', { timeout: 30_000 });
  await expect(result).toContainText('prize units');
  await result.getByRole('grid', { name: 'Shove range' }).getByRole('gridcell', { name: /^AA:/ }).click();
  await expect(page.getByTestId('pushfold-pusher-detail')).toContainText('All-in 100%');
});

test('push/fold calculator explains bad input', async ({ page }) => {
  await page.goto('/#/pushfold');
  await page.getByLabel('Seat that calls (usually the big blind)').fill('2');
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByTestId('pushfold-result')).toContainText('two different players');
});
