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
  ['review', '/#/play/review', 'hand-review'],
  ['reports', '/#/solve/reports', 'report-flops'],
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

test('keyboard: skip link, menu, and the text-size setting', async ({ page }) => {
  await open(page, '/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main|#\/$/);
  // The menu is reachable and works with Enter.
  const learn = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Learn' });
  await learn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('course-map')).toBeVisible();
  // Larger text scales the root font size.
  await page.goto('/#/settings');
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  await page.getByRole('radio', { name: 'Larger', exact: true }).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).not.toBe(before);
});
