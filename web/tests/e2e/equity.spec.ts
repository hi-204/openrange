import { expect, test } from '@playwright/test';

test('equity calculator: exact two-way result on a flop, readable range errors', async ({ page }) => {
  await page.goto('/#/equity');
  const ranges = page.getByPlaceholder('e.g. AA, AKs, or AhKh');
  await ranges.nth(0).fill('AhKh');
  await ranges.nth(1).fill('QQ+, AKo');
  await page.getByLabel('Board (0, 3, 4 or 5 cards)').fill('Qh 7h 2c');
  await page.getByRole('button', { name: 'Calculate' }).click();

  const result = page.getByTestId('equity-result');
  await expect(result).toContainText('Exact');
  const a = parseFloat((await page.getByTestId('equity-0').innerText()).replace('%', ''));
  const b = parseFloat((await page.getByTestId('equity-1').innerText()).replace('%', ''));
  expect(a + b).toBeCloseTo(100, 1);

  await ranges.nth(1).fill('QQ+, ZZ');
  await expect(page.getByText(/can't read "ZZ"/)).toBeVisible();
});
