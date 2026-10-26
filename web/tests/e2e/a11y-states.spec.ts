// Accessibility (axe, WCAG 2.1 A/AA) on interactive states the screen checks don't reach:
// solved widgets, open panels, a hand in progress, dialogs and the phone layout.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { open } from './helpers';

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')} — ${v.help}`);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      // Several axe scans per test: more than the default 30 s.
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    });

    test(`a11y: solved toy game and chart cell detail (${scheme})`, async ({ page }) => {
      await open(page, '/#/learn/5.6');
      const toy = page.getByTestId('widget-toygame');
      await toy.getByRole('button', { name: /Solve/ }).click();
      await expect(toy.getByTestId('toy-convergence')).toBeVisible({ timeout: 30_000 });
      await page.goto('/#/learn/3.7');
      await page.getByTestId('chart-embed').first().getByRole('gridcell', { name: /^77:/ }).click();
      await expect(page.getByTestId('chart-cell').first()).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });

    test(`a11y: workbench after a solve, lock panel and opponent range open (${scheme})`, async ({ page }) => {
      await open(page, '/#/solver');
      await page.getByLabel('Max iterations').fill('200');
      await page.getByRole('button', { name: 'Solve' }).click();
      const browser = page.getByTestId('node-browser');
      await expect(browser).toContainText('OOP to act', { timeout: 30_000 });
      await browser.getByTestId('lock-panel').locator('summary').click();
      await browser.getByTestId('view-opponent').click();
      await page.locator('details', { hasText: 'Paint the ranges' }).locator('summary').click();
      expect(await axe(page)).toEqual([]);
    });

    test(`a11y: a hand in progress with coaching (${scheme})`, async ({ page }) => {
      await open(page, '/#/play');
      await page.getByTestId('deal').click();
      await expect(page.getByTestId('play-actions').or(page.getByTestId('play-result'))).toBeVisible({ timeout: 20_000 });
      expect(await axe(page)).toEqual([]);
    });

    test(`a11y: texture drill, glossary and onboarding (${scheme})`, async ({ page, browser, baseURL }) => {
      await open(page, '/#/train/math?drill=texture');
      await expect(page.getByTestId('math-problem')).toContainText('Which describes this flop?');
      expect(await axe(page)).toEqual([]);
      await page.goto('/#/glossary');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      // A fresh profile shows the onboarding dialog.
      const context = await browser.newContext({ baseURL, colorScheme: scheme });
      const fresh = await context.newPage();
      await fresh.goto('/');
      await expect(fresh.getByTestId('onboarding')).toBeVisible();
      expect(await axe(fresh)).toEqual([]);
      await context.close();
    });

    test(`a11y: phone layout of a lesson and the trainer (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await open(page, '/#/learn/4.2');
      await expect(page.getByTestId('lesson')).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto('/#/train/preflop');
      await expect(page.getByTestId('preflop-question')).toBeVisible({ timeout: 15_000 });
      expect(await axe(page)).toEqual([]);
    });
  });
}
