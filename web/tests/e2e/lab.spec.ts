import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

// Math Lab (D-087): formula and tool, a two-part pot-odds problem graded part by part, the
// solved-spot comparison, and no accessibility violations once the panels are open.
test('Math Lab: pot-odds problem, graded part by part with a worked solution', async ({ page }) => {
  await open(page, '/#/lab/potodds');
  await expect(page.getByTestId('lab-formula')).toContainText('C ÷ (P + C)');
  await expect(page.getByTestId('widget-potodds')).toBeVisible();
  await page.getByTestId('lab-start').click();
  const problem = page.getByTestId('lab-problem');
  await expect(problem).toContainText('your opponent bets');
  // Read the pot and bet from the problem and type the exact price.
  const text = await problem.innerText();
  const [, pot, bet] = text.match(/the pot is ([\d.]+) bb and your opponent bets ([\d.]+) bb/)!;
  const required = Number(bet) / (Number(pot) + 2 * Number(bet));
  await problem.getByLabel(/Part 1 of 2/).fill(`${(required * 100).toFixed(1)}%`);
  await problem.getByRole('radio', { name: 'Fold' }).click();
  await problem.getByRole('button', { name: 'Check' }).click();
  const results = page.getByTestId('lab-results');
  await expect(results.locator('li').first()).toHaveAttribute('data-correct', 'true');
  await expect(page.getByTestId('lab-answer').getByTestId('coach-why')).toContainText('1 in');
  await expect(page.getByTestId('lab-answer').getByTestId('coach-why')).toContainText('Your exact equity against');
});

test('Math Lab: MDF next to a solved river spot, and the sizing trainer', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, '/#/lab/mdf');
  await page.getByTestId('mdf-solve').click();
  const panel = page.getByTestId('mdf-solved');
  await expect(panel.locator('table').first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText('Bluff share (solution)');
  await expect(panel).toContainText(/the solution defends [\d.]+%/);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);

  await page.goto('/#/lab/sizing');
  await page.getByTestId('lab-start').click();
  await page.getByTestId('sizing-solve').click();
  const trainer = page.getByTestId('sizing-trainer');
  await trainer.getByRole('group', { name: 'Your action' }).getByRole('button').first().click({ timeout: 60_000 });
  await expect(trainer.getByTestId('sizing-result')).toContainText('Solution plays it');
});
