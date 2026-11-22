import { expect, test } from '@playwright/test';
import { open } from './helpers';

// Phase 5 content (D-092).
test('new lessons open, the journal keeps goals and reflections, guides and the responsible-play note show', async ({ page }) => {
  await open(page, '/#/learn/0.9');
  await expect(page.getByRole('heading', { name: 'How to study efficiently' })).toBeVisible();
  await page.goto('/#/learn/6.10');
  await expect(page.getByRole('heading', { name: 'Session goals and reflection' })).toBeVisible();

  await page.goto('/#/play/journal');
  const goal = page.getByTestId('journal-goal');
  await goal.getByLabel('Your process goal for this session').fill('Take a break after every big pot');
  await goal.getByRole('button', { name: 'Save goal' }).click();
  const refl = page.getByTestId('journal-reflection');
  await refl.getByRole('radio', { name: 'Good' }).check();
  await refl.getByLabel('One focus for next time').fill('Fold the bottom of my UTG range');
  await refl.getByRole('button', { name: 'Save reflection' }).click();
  const entries = page.getByTestId('journal-entries');
  await expect(entries).toContainText('Goal: Take a break after every big pot');
  await expect(entries).toContainText('Next focus: Fold the bottom of my UTG range');
  // The next goal starts from the last focus.
  await page.reload();
  await expect(page.getByTestId('journal-goal').getByLabel('Your process goal for this session')).toHaveValue('Fold the bottom of my UTG range');

  await page.getByTestId('page-guide').locator('summary').click();
  await expect(page.getByTestId('page-guide')).toContainText('Quick play deals single hands');
  await page.goto('/');
  await expect(page.getByText("It isn't gambling advice")).toBeVisible();
});

test('Stats progress: week, trend, goals and skills; the preflop drill offers automatic difficulty', async ({ page }) => {
  await open(page, '/#/stats');
  await expect(page.getByTestId('progress-week')).toContainText('graded answers');
  await expect(page.getByTestId('progress-trend')).toBeVisible();
  await page.getByTestId('progress-goals').getByRole('switch', { name: 'Use weekly goals' }).click();
  await expect(page.getByTestId('progress-goals')).toContainText('0 of 3 study days this week');
  await expect(page.getByTestId('progress-skills')).toContainText('Skill estimates');
  await page.goto('/#/train');
  await page.getByTestId('preflop-filters').locator('summary').click();
  await page.getByTestId('difficulty').selectOption('auto');
  await expect(page.getByTestId('auto-difficulty')).toContainText('Auto: any difficulty until you have 10 graded answers');
});

test('hand of the day on Home and the review inbox on Stats', async ({ page }) => {
  await open(page, '/');
  const daily = page.getByTestId('daily-hand');
  await daily.getByRole('group', { name: 'Your decision' }).getByRole('button').first().click();
  await expect(page.getByTestId('daily-result')).toContainText('EV of each action');
  // Answered once a day: still answered after a reload.
  await page.reload();
  await expect(page.getByTestId('daily-result')).toBeVisible();
  await page.goto('/#/stats');
  await expect(page.getByTestId('review-inbox')).toContainText('Nothing due for review right now.');
});

