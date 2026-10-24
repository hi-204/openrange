import { expect, test } from '@playwright/test';

test('app loads the solver in a worker and makes no external requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    const local = url.origin === 'http://localhost:4173';
    if (!local && url.protocol !== 'data:' && url.protocol !== 'blob:') external.push(req.url());
  });

  await page.goto('/');
  await expect(page.getByTestId('combo-count')).toContainText('1326');
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  expect(external).toEqual([]);
});
