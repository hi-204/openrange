import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

// Phase 3 playing modes (D-090).
async function playOutHand(page: Page) {
  // Fold or check whenever it's our turn until the hand ends.
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('session-hand-result').isVisible()) return;
    const actions = page.getByTestId('play-actions');
    if (await actions.isVisible()) {
      const check = actions.getByRole('button', { name: /^Check/ });
      await ((await check.count()) ? check.first() : actions.getByRole('button', { name: /^Fold/ }).first()).click();
    }
    await page.waitForTimeout(250);
  }
}

test('cash session: live hints, a full hand, the review and the report', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '/#/play/session');
  const setup = page.getByTestId('session-setup');
  await setup.getByRole('radio', { name: 'Live hints' }).click();
  await setup.getByRole('radio', { name: 'Fast' }).click();
  await page.getByTestId('session-start').click();
  await page.getByTestId('session-deal').click();
  // Wait for our first decision (or the hand ending before we act).
  await expect(page.getByTestId('play-actions').or(page.getByTestId('session-hand-result'))).toBeVisible({ timeout: 30_000 });
  if (await page.getByTestId('play-actions').isVisible()) {
    await page.getByTestId('hint-more').click();
    await expect(page.getByTestId('live-hints')).toContainText('Stack-to-pot ratio');
  }
  await playOutHand(page);
  await expect(page.getByTestId('session-hand-result')).toContainText('This hand:');
  await page.getByTestId('session-report-toggle').click();
  await expect(page.getByTestId('session-report')).toContainText('Hands played: 1');
  await expect(page.getByTestId('session-bots')).toBeVisible();
});

test('sit-and-go shows the blind level and players left', async ({ page }) => {
  await open(page, '/#/play/session');
  await page.getByTestId('session-setup').getByRole('radio', { name: 'Sit-and-go' }).click();
  await page.getByTestId('session-start').click();
  await expect(page.getByTestId('session-info')).toContainText('Blinds 10/20, ante 0 · 6 players left');
  await page.getByTestId('session-deal').click();
  await expect(page.getByTestId('play-actions').or(page.getByTestId('session-hand-result'))).toBeVisible({ timeout: 30_000 });
});

test('spot practice plays a solved spot and reviews the hand at the end', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '/#/play/practice?spot=river-qj742&focus=bluffcatch');
  await page.getByRole('button', { name: 'Solve this spot' }).click();
  await expect(page.getByTestId('your-move')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Fold/ }).first().click();
  await expect(page.getByTestId('practice-review')).toContainText('Decision 1: you played Fold');
});
