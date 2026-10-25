import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('preflop drill: answer with the keyboard, get an EV-loss grade, see it in the review', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== 'http://localhost:4173' && url.protocol !== 'data:' && url.protocol !== 'blob:') external.push(req.url());
  });
  await open(page, '/#/train');
  const question = page.getByTestId('preflop-question');
  await expect(question).toBeVisible({ timeout: 15_000 });
  await expect(question).toContainText('bb');

  for (let i = 0; i < 3; i++) {
    // Wait until the hand is dealt and waiting for us: a key pressed during the deal is ignored.
    await expect(question).toContainText('Your move.');
    // "1" is always the first action (Fold); the grade and explanation follow.
    await page.keyboard.press('1');
    const answer = page.getByTestId('answer');
    await expect(answer.getByTestId('grade')).toBeVisible();
    await expect(answer.getByTestId('coach-verdict')).not.toBeEmpty();
    await expect(answer.getByTestId('coach-idea')).not.toBeEmpty();
    await expect(answer.getByTestId('explanation')).toContainText('EV of each action');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('answer')).toHaveCount(0);
  }

  await page.getByRole('link', { name: 'Stats' }).first().click();
  await expect(page.getByTestId('review-summary')).toContainText('3 answers on this device');
  // Three answers are far below the minimum sample: no numbers, no leak.
  await expect(page.getByTestId('stats-bb')).toContainText('not enough data yet (3 of 30)');
  await expect(page.locator('[data-leak="true"]')).toHaveCount(0);
  expect(external).toEqual([]);
});

test('preflop drill: heads-up spots explain the pot odds or the shove math', async ({ page }) => {
  await open(page, '/#/train');
  await page.getByTestId('preflop-filters').locator('summary').click();
  // Only the exact heads-up charts.
  const sources = page.getByTestId('preflop-filters').locator('fieldset').first().getByRole('checkbox');
  const n = await sources.count();
  for (let i = 0; i < n; i++) {
    const box = sources.nth(i);
    const label = (await box.locator('xpath=..').innerText()).trim();
    if (label.startsWith('Heads-up') !== (await box.isChecked())) await box.click();
  }
  const question = page.getByTestId('preflop-question');
  await expect(question).toContainText('Heads-up');
  // Focus is still on a filter checkbox (keys typed into form fields are ignored), so click.
  await question.getByRole('button').nth(1).click();
  await expect(page.getByTestId('explanation')).toContainText(/you need .* equity|If you shove, the big blind/);
  await expect(page.getByTestId('answer')).toContainText('Exact solver result');
});

test('postflop drill: solve a river spot and play a hand with graded decisions', async ({ page }) => {
  await open(page, '/#/train');
  await page.getByRole('link', { name: 'Postflop' }).click();
  await expect(page).toHaveURL(/#\/train\/postflop/);
  await page.getByRole('button', { name: 'Solve this spot' }).click();
  await expect(page.getByTestId('postflop-status')).toContainText('Solved to', { timeout: 30_000 });
  const hand = page.getByTestId('postflop-hand');
  await expect(hand).toContainText('The hand starts on the river');

  // Play the first action at every decision until the hand ends.
  for (let guard = 0; guard < 6; guard++) {
    // Wait for the hand to settle: either our move or the end of the hand.
    await expect(page.getByTestId('your-move').or(page.getByTestId('hand-over'))).toBeVisible();
    if (await page.getByTestId('hand-over').isVisible()) break;
    await page.keyboard.press('1');
    const answer = page.getByTestId('answer');
    await expect(answer.getByTestId('grade')).toBeVisible();
    await expect(answer.getByTestId('explanation')).toContainText('solved in your browser to an exploitability of');
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('hand-over')).toBeVisible();
  await expect(page.getByTestId('villain-cards')).toBeVisible();
});
