import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('onboarding sets Expert mode for experienced players, and the mode can be switched', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByTestId('onboarding');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /I'm experienced/ }).click();
  await dialog.getByTestId('onboarding-done').click();
  await expect(dialog).toBeHidden();
  const mode = page.getByRole('radiogroup', { name: 'Mode' });
  await expect(mode.getByRole('radio', { name: 'Expert' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('main')).toHaveAttribute('data-mode', 'expert');
  // Switch to Guided from the top bar; it sticks across a reload and onboarding doesn't return.
  await mode.getByRole('radio', { name: 'Guided' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-mode', 'guided');
  await page.reload();
  await expect(page.locator('main')).toHaveAttribute('data-mode', 'guided');
  await expect(page.getByTestId('onboarding')).toBeHidden();
});

test('settings are searchable, persist, and change the display', async ({ page }) => {
  await open(page, '/#/settings');
  await page.getByPlaceholder('Search settings').fill('felt');
  const felt = page.getByTestId('setting-felt');
  await expect(felt).toBeVisible();
  await expect(page.getByTestId('setting-theme')).toBeHidden();
  await felt.getByRole('radio', { name: 'Navy' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-felt', 'navy');
  await page.getByPlaceholder('Search settings').fill('');
  await page.getByTestId('setting-theme').getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-felt', 'navy');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Reset a section to its defaults.
  await page.getByTestId('settings-display').getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-felt', 'green');
});

test('lesson reader: computed numbers, callouts, widgets, instant quiz feedback, practice link', async ({ page }) => {
  await open(page, '/#/learn');
  await page.getByTestId('course-map').getByRole('link', { name: /^2\.3 Pot odds/ }).click();
  const lesson = page.getByTestId('lesson');
  await expect(lesson.getByRole('heading', { name: 'Pot odds', level: 2 })).toBeVisible();
  await expect(page.getByTestId('objectives')).toBeVisible();
  // A computed price and a build-time equity.
  await expect(lesson).toContainText('5 ÷ (15 + 5) = 25%');
  await expect(lesson).toContainText('20.5%');
  await expect(page.getByTestId('callout-key')).toBeVisible();
  await expect(page.getByTestId('widget-potodds')).toContainText('You need at least');
  // Glossary term with a definition.
  await expect(lesson.locator('.gloss').first()).toBeVisible();
  // Instant feedback on the first question.
  const quiz = page.getByTestId('quiz');
  await quiz.locator('fieldset').first().getByRole('radio').nth(1).check();
  await expect(quiz.locator('fieldset').first()).toContainText('Right.');
  await expect(page.getByTestId('practice').getByRole('link', { name: /Math drill/ })).toHaveAttribute('href', '#/train/math?drill=potodds');
});

test('math drill: answer, coaching card with the worked solution', async ({ page }) => {
  await open(page, '/#/train/math?drill=potodds');
  const problem = page.getByTestId('math-problem');
  await expect(problem).toContainText('What equity do you need to call?');
  await problem.getByLabel('Your answer').fill('1%');
  await problem.getByRole('button', { name: 'Check' }).click();
  const card = page.getByTestId('math-answer');
  await expect(card.getByTestId('coach-verdict')).toContainText(/Not quite|Right|Correct|Spot on/);
  await expect(card.getByTestId('coach-why')).toContainText('Price = your call ÷ the final pot');
});

test('home dashboard and the poker table render', async ({ page }) => {
  await open(page, '/');
  await expect(page.getByTestId('daily-plan')).toBeVisible();
  await expect(page.getByTestId('next-step')).toContainText('placement');
  await page.getByRole('link', { name: 'Play' }).first().click();
  await expect(page.getByTestId('poker-table')).toBeVisible();
  await expect(page.getByTestId('hero-seat')).toContainText('You');
  await expect(page.getByTestId('action-history')).toContainText('CO raises 2.5 bb');
});
