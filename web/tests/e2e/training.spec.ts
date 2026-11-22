import { expect, test } from '@playwright/test';
import { open } from './helpers';

// Phase 2 training modes (D-089).
test('spot library: filter, then drill a facing-aggression situation', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '/#/train/library');
  const count = page.getByTestId('library-count');
  await expect(count).toContainText(/of \d+ spots/);
  await page.getByRole('checkbox', { name: 'River' }).check();
  await page.getByLabel('Search').fill('bluff');
  await expect(count).toContainText(/^[1-9]\d* of/);
  await page.getByTestId('library-item').first().getByRole('link', { name: 'Drill this' }).click();
  await expect(page.getByTestId('situation')).toHaveValue('bluffcatch');
  await page.getByRole('button', { name: 'Solve this spot' }).click();
  // The hand starts facing the bet: the hero's first decision is Fold / Call / Raise.
  await expect(page.getByTestId('your-move')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Fold/ }).first().click();
  await page.getByRole('button', { name: /Next|Continue/ }).first().click();
  await expect(page.getByTestId('hand-ev-loss')).toContainText('EV given up this hand');
});

test('hand reading: paint a read and compare it with the solution', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '/#/train/reading');
  await expect(page.getByTestId('reading-task')).toContainText('Paint the hands', { timeout: 60_000 });
  await page.getByRole('grid', { name: 'Your read (click cells)' }).getByRole('gridcell').first().click();
  await page.getByRole('button', { name: 'Compare with the solution' }).click();
  await expect(page.getByTestId('reading-score')).toContainText(/You found \d+% of their range/);
  await expect(page.getByTestId('reading-solution')).toBeVisible();
});

test('tournament drill: an ICM push/fold decision next to chips', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '/#/train/tournament');
  await expect(page.getByTestId('tourney-question')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('group', { name: 'Your decision' }).getByRole('button').first().click();
  const result = page.getByTestId('tourney-result');
  await expect(result).toContainText('ICM EV (share of the prize pool)');
  await expect(result).toContainText('In chips instead');
});

test('range drill shows the EV difference; challenge sets and weak spots', async ({ page }) => {
  await open(page, '/#/train/ranges');
  await expect(page.getByTestId('range-task')).toBeVisible();
  await page.getByRole('button', { name: 'Check my range' }).click();
  await expect(page.getByTestId('range-ev')).toContainText('EV difference against the chart');

  await page.goto('/#/lab/blockers');
  await page.getByTestId('lab-challenge').click();
  await expect(page.getByTestId('challenge-progress')).toContainText('Problem 1 of 10');

  await page.goto('/#/stats');
  await expect(page.getByTestId('weak-session')).toContainText('Practice my weak spots');
});
