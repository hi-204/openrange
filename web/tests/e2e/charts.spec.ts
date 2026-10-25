import { expect, test } from '@playwright/test';

test('charts: exact heads-up push/fold with provenance and per-hand EV', async ({ page }) => {
  await page.goto('/#/charts');
  await expect(page.getByTestId('provenance-badge')).toContainText('Exact solver result');
  await page.getByLabel('Stack').selectOption({ label: '10 bb' });
  await page.getByLabel('Decision').selectOption({ label: 'SB shove or fold, 10 bb' });
  await page.getByRole('gridcell', { name: /^AA:/ }).click();
  const detail = page.getByTestId('cell-detail');
  await expect(detail).toContainText('AA (6 combos)');
  await expect(detail).toContainText('All-in');
  await expect(detail).toContainText('bb');
  // The badge opens the full provenance.
  await page.getByTestId('provenance-badge').click();
  await expect(page.getByText('solver-cli gen-charts pushfold-hu')).toBeVisible();
});

test('charts: approximate families say so, out-of-band ones warn loudly', async ({ page }) => {
  await page.goto('/#/charts');
  await page.getByLabel('Chart set').selectOption({ label: '6-handed push/fold (approximate)' });
  await expect(page.getByTestId('provenance-badge')).toContainText('Approximate model');
  await expect(page.getByTestId('approx-warning')).toBeVisible();
  // Cash charts are only present when generated locally (held back from the repo, D-047).
  const cash = page.getByRole('option', { name: '6-max cash, 100 bb (approximate model)' });
  if ((await cash.count()) > 0) {
    await page.getByLabel('Chart set').selectOption({ label: '6-max cash, 100 bb (approximate model)' });
    await expect(page.getByTestId('approx-warning')).toBeVisible();
    const band = page.getByTestId('band-warning');
    if (await band.isVisible()) await expect(band).toContainText('opens');
  }
});

test('charts: compare two decisions side by side', async ({ page }) => {
  await page.goto('/#/charts');
  await page.getByLabel('Stack').selectOption({ label: '10 bb' });
  await page.getByLabel('Decision').selectOption({ label: 'SB shove or fold, 10 bb' });
  await page.getByLabel('Compare with').selectOption({ label: 'BB call or fold vs SB shove, 10 bb' });
  await expect(page.getByTestId('chart-view').getByRole('grid')).toHaveCount(2);
});
