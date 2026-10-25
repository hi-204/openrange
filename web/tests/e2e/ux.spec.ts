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

test('placement quiz: a weak level sets the suggested start, and the course map shows it', async ({ page }) => {
  await open(page, '/#/learn/placement');
  const quiz = page.getByTestId('placement-quiz');
  const sets = quiz.locator('fieldset');
  await expect(sets).toHaveCount(15);
  // Right answers from placement.yaml; Level 3 (questions 10–12) answered wrongly on purpose.
  const right = [1, 1, 0, 1, 2, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0];
  for (let i = 0; i < 15; i++) await sets.nth(i).getByRole('radio').nth(i >= 9 && i < 12 ? 1 : right[i]!).check();
  await page.getByRole('button', { name: 'See my result' }).click();
  await expect(page.getByTestId('placement-result')).toContainText('Suggested start: Level 3');
  await expect(page.getByTestId('placement-result')).toContainText('Level 3: 0 of 3 right');
  await page.getByRole('link', { name: 'Go to the course' }).click();
  await expect(page.getByTestId('course-map')).toContainText('starting at Level 3');
});

test('a Level 4 lesson solves its spot in the browser', async ({ page }) => {
  await open(page, '/#/learn/4.9');
  const lesson = page.getByTestId('lesson');
  await expect(lesson.getByRole('heading', { name: 'Sizing basics', level: 2 })).toBeVisible();
  await expect(lesson).toContainText('57.1%'); // computed MDF in the table
  await lesson.getByRole('button', { name: /Solve/ }).click();
  await expect(page.getByTestId('minisolver-status')).toContainText('Solved to', { timeout: 30_000 });
});

test('range drill: paint a range, check it, see the chart and the combos off', async ({ page }) => {
  await open(page, '/#/train/ranges');
  const drill = page.getByTestId('range-drill');
  await expect(page.getByTestId('range-task')).toContainText(/Build the/);
  const grid = drill.getByRole('grid', { name: 'Your range' });
  for (const h of ['AA', 'KK', 'AKs']) await grid.getByRole('gridcell', { name: new RegExp(`^${h}:`) }).click();
  await expect(drill).toContainText('Your range: 16 combos');
  await drill.getByRole('button', { name: 'Check my range' }).click();
  await expect(page.getByTestId('range-score')).toContainText('combos off');
  await expect(page.getByTestId('range-result')).toContainText('Exact solver result');
});

test('Level 5–6 widgets: the toy game matches theory; ICM shows the bubble factor', async ({ page }) => {
  await open(page, '/#/learn/5.1');
  const toy = page.getByTestId('widget-toygame');
  await toy.getByRole('button', { name: /Solve/ }).click();
  await expect(toy.getByTestId('toy-status')).toContainText('Solved by the engine', { timeout: 30_000 });
  // Pot-sized bet: a third of the bets are bluffs and the caller calls half, in both columns.
  await expect(toy.getByTestId('toy-result')).toContainText(/Bluffs among the bets\s*33\.3%\s*33\.3%/);
  await expect(toy.getByTestId('toy-result')).toContainText(/Caller calls\s*50\.0%\s*50\.0%/);
  await page.goto('/#/learn/6.4');
  await expect(page.getByTestId('icm-bubble')).toContainText('Bubble factor 1.5');
});

test('math drill: board textures are multiple choice with a worked answer', async ({ page }) => {
  await open(page, '/#/train/math?drill=texture');
  const problem = page.getByTestId('math-problem');
  await expect(problem).toContainText('Which describes this flop?');
  // Choices answer at once.
  await problem.getByRole('button', { name: /rainbow|two-tone|monotone/ }).first().click();
  await expect(page.getByTestId('math-answer').getByTestId('coach-why')).toContainText(/suit/);
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
  await expect(page.getByTestId('deal')).toBeVisible();
});

test('play mode: deal, act, see coaching, finish and replay the hand', async ({ page }) => {
  await open(page, '/#/play');
  await page.getByTestId('deal').click();
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('play-result').isVisible()) break;
    const actions = page.getByTestId('play-actions');
    if (await actions.isVisible()) {
      const passive = actions.getByRole('button', { name: /^(Check|Call)/ });
      await (await passive.count() ? passive.first() : actions.getByRole('button').first()).click();
    } else await page.waitForTimeout(300);
  }
  await expect(page.getByTestId('play-result')).toContainText('Hand over', { timeout: 20_000 });
  await expect(page.getByTestId('poker-table')).toContainText(/chart|rule-based/);
  await page.getByTestId('play-replay').locator('summary').click();
  await expect(page.getByTestId('replay')).toContainText('Preflop');
});

test('hand review: load the example, see references and the not-graded reasons', async ({ page }) => {
  await open(page, '/#/play/review');
  await page.getByRole('button', { name: 'Load an example' }).click();
  await expect(page.getByTestId('hand-review-summary')).toContainText('2 hands read');
  const replay = page.getByTestId('replay');
  await expect(replay.getByTestId('decision-practice').first()).toContainText('Approximate reference');
  await expect(replay.getByTestId('decision-none').first()).toContainText('Not graded (no solved reference)');
});

test('flop report: groups by texture with provenance', async ({ page }) => {
  await open(page, '/#/solve/reports');
  const r = page.getByTestId('reports');
  await expect(r).toContainText('Flop report: BTN opens, BB calls');
  await expect(r).toContainText('Approximate model');
  await expect(page.getByTestId('report-groups')).toContainText('By highest card');
  await expect(page.getByTestId('report-flops').locator('tbody tr')).toHaveCount(48);
});
