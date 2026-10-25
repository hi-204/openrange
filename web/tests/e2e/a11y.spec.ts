// Automated accessibility checks (axe, WCAG 2.1 A/AA rules) on every main screen, in both
// themes. Fails on any violation.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

const SCREENS: [string, string, string | null][] = [
  ['home', '/', 'daily-plan'],
  ['learn', '/#/learn', 'course-map'],
  ['lesson', '/#/learn/2.3', 'lesson'],
  ['train', '/#/train', 'preflop-question'],
  ['math', '/#/train/math', 'math-problem'],
  ['ranges', '/#/train/ranges', 'range-task'],
  ['lesson-games', '/#/learn/6.4', 'icm-result'],
  ['stats', '/#/stats', 'course-progress'],
  ['solve', '/#/solve/charts', null],
  ['play', '/#/play', 'poker-table'],
  ['settings', '/#/settings', 'settings'],
];

for (const scheme of ['light', 'dark'] as const) {
  for (const [name, path, ready] of SCREENS) {
    test(`a11y: ${name} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await open(page, path);
      if (ready) await expect(page.getByTestId(ready)).toBeVisible({ timeout: 15_000 });
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')} — ${v.help}`);
      expect(summary).toEqual([]);
    });
  }
}

test('a11y: onboarding dialog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('onboarding')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')} — ${v.help}`)).toEqual([]);
});
