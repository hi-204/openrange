import { expect, test } from '@playwright/test';

test('river solver: solves in the worker, shows provenance, browses nodes', async ({ page }) => {
  await page.goto('/#/solver');
  await page.getByLabel('Max iterations').fill('300');
  await page.getByLabel('Target exploitability (% of pot)').fill('0');
  await page.getByRole('button', { name: 'Solve' }).click();

  await expect(page.getByTestId('solver-badge')).toContainText('300 iterations', { timeout: 30_000 });
  await expect(page.getByTestId('solver-badge')).toContainText('exploitability');
  const browser = page.getByTestId('node-browser');
  await expect(browser).toContainText('OOP to act');
  await expect(browser).toContainText('Qs Jh 7d 4c 2s');

  // Follow "Check": IP acts next.
  await browser.getByRole('button', { name: /^Check/ }).click();
  await expect(browser).toContainText('IP to act');

  // Pick a hand and see its combos.
  await browser.getByRole('gridcell', { name: /^AQs:/ }).click();
  await expect(browser).toContainText('AQs: strategy and EV per combo');
});

test('river solver: refuses a spot over the memory budget with a clear message', async ({ page }) => {
  await page.goto('/#/solver');
  await page.getByLabel('Memory budget (MB)').fill('0.5');
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByTestId('solver-progress')).toContainText('memory budget');
});
