import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

// Phase 4 study tools (D-091).
test('compare two charts across stacks, and the ICM calculator', async ({ page }) => {
  await open(page, '/#/solve/compare');
  await expect(page.getByTestId('compare-shares')).toContainText('of all hands');
  await expect(page.getByTestId('compare-largest')).toContainText(/A \d+%, B \d+%/);
  await page.goto('/#/solve/icm');
  await expect(page.getByTestId('widget-icm')).toBeVisible();
});

test('a note on a chart shows in the spot library; the chart saves as a PNG', async ({ page }) => {
  await open(page, '/#/solve/charts');
  await expect(page.getByTestId('chart-view')).toBeVisible();
  const notes = page.getByTestId('spot-notes');
  await notes.getByRole('textbox').fill('Remember: suited aces shove wide here.');
  await notes.getByRole('button', { name: 'Save note' }).click();
  await expect(notes.getByRole('status')).toContainText('Saved.');
  const [png] = await Promise.all([page.waitForEvent('download'), page.getByTestId('chart-image').click()]);
  expect(png.suggestedFilename()).toMatch(/^openrange-.+\.png$/);
  await page.goto('/#/train/library');
  await page.getByLabel('Search').fill('suited aces shove');
  await expect(page.getByTestId('library-note').first()).toContainText('Your note: Remember: suited aces');
});

test('workbench spot files: save, open, and a clear error for a bad file', async ({ page }, info) => {
  await open(page, '/#/solve/workbench');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('spot-save').click()]);
  const file = await download.path();
  await page.getByTestId('spot-open').setInputFiles(file);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const bad = info.outputPath('bad-spot.json');
  writeFileSync(bad, '{"format":"openrange.spot/1","spot":{}}');
  await page.getByTestId('spot-open').setInputFiles(bad);
  await expect(page.getByRole('alert')).toContainText("Couldn't open that spot file");
});
