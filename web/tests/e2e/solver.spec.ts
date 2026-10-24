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

test('turn solver: deal a river card and keep browsing', async ({ page }) => {
  await page.goto('/#/solver');
  await page.getByRole('button', { name: 'Turn', exact: true }).click();
  await page.getByLabel('Max iterations').fill('40');
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByTestId('solver-badge')).toBeVisible({ timeout: 60_000 });

  const browser = page.getByTestId('node-browser');
  await browser.getByRole('button', { name: /^Check/ }).click();
  await expect(browser).toContainText('IP to act');
  await browser.getByRole('button', { name: /^Check/ }).click();
  await expect(browser).toContainText('Deal the river card');
  await browser.getByRole('list', { name: 'Cards' }).getByRole('button').first().click();
  await expect(browser).toContainText('OOP to act');
  await expect(browser).toContainText('Qs Jh 7d 4c 2');
});

test('solver: refuses a spot over the memory budget with a clear message', async ({ page }) => {
  await page.goto('/#/solver');
  await page.getByLabel('Memory budget (MB)').fill('0.5');
  await page.getByLabel(/simplify the tree automatically/).uncheck();
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByTestId('solver-progress')).toContainText('memory budget');
});

test('solver: simplifies a spot that does not fit and says so', async ({ page }) => {
  await page.goto('/#/solver');
  // Budget = the solver's own estimate for the spot as entered, minus 1 kB: the full tree no
  // longer fits, while the first simplification (dropping river raises) saves far more than that.
  const estimate = page.getByTestId('memory-estimate');
  await expect(estimate).toBeVisible();
  const bytes = Number(await estimate.getAttribute('data-bytes'));
  expect(bytes).toBeGreaterThan(1e6);
  await page.getByLabel('Memory budget (MB)').fill(((bytes - 1000) / 1e6).toFixed(6));
  await page.getByLabel('Max iterations').fill('20');
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByTestId('abstraction-warning')).toContainText('river', { timeout: 30_000 });
  await expect(page.getByTestId('solver-badge')).toContainText('simplified tree', { timeout: 30_000 });
});
