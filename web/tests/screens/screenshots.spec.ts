// Every main screen at 1440, 1024 and 390 px wide, dark and light, saved to docs/screenshots.
import { expect, test, type Page } from '@playwright/test';
import { open } from '../e2e/helpers';

const OUT = '../docs/screenshots';
const WIDTHS = [1440, 1024, 390];
const THEMES = ['dark', 'light'] as const;

type Screen = { name: string; path: string; prepare?: (page: Page) => Promise<void>; onboarding?: boolean; scrollTo?: string };

const SCREENS: Screen[] = [
  { name: 'onboarding', path: '/', onboarding: true },
  { name: 'home', path: '/', prepare: async (p) => void (await expect(p.getByTestId('daily-plan')).toBeVisible()) },
  { name: 'learn', path: '/#/learn', prepare: async (p) => void (await expect(p.getByTestId('course-map')).toBeVisible()) },
  {
    name: 'lesson',
    path: '/#/learn/2.3',
    prepare: async (p) => {
      await expect(p.getByTestId('widget-potodds')).toContainText('You need at least');
    },
  },
  {
    name: 'train-preflop-coach',
    path: '/#/train/preflop?files=pushfold-hu.json',
    scrollTo: 'answer',
    prepare: async (p) => {
      await expect(p.getByTestId('preflop-question')).toBeVisible();
      await p.keyboard.press('2');
      await expect(p.getByTestId('answer')).toBeVisible();
    },
  },
  {
    name: 'train-preflop-table',
    path: '/#/train/preflop?files=pushfold-6max.json',
    scrollTo: 'poker-table',
    prepare: async (p) => void (await expect(p.getByTestId('poker-table')).toBeVisible()),
  },
  {
    name: 'train-postflop-coach',
    path: '/#/train/postflop',
    scrollTo: 'answer',
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Solve this spot' }).click();
      await expect(p.getByTestId('your-move')).toBeVisible({ timeout: 30_000 });
      await p.keyboard.press('1');
      await expect(p.getByTestId('answer')).toBeVisible();
    },
  },
  {
    name: 'train-math',
    path: '/#/train/math?drill=potodds',
    scrollTo: 'math-problem',
    prepare: async (p) => {
      await p.getByLabel('Your answer').fill('25%');
      await p.getByRole('button', { name: 'Check' }).click();
      await expect(p.getByTestId('math-answer')).toBeVisible();
    },
  },
  { name: 'stats', path: '/#/stats', prepare: async (p) => void (await expect(p.getByTestId('course-progress')).toBeVisible()) },
  {
    name: 'solve-workbench',
    path: '/#/solve/workbench',
    scrollTo: 'node-browser',
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Solve' }).click();
      await expect(p.getByTestId('node-browser')).toBeVisible({ timeout: 30_000 });
    },
  },
  { name: 'solve-charts', path: '/#/solve/charts', scrollTo: 'chart-view', prepare: async (p) => void (await expect(p.getByTestId('chart-view')).toBeVisible()) },
  { name: 'play', path: '/#/play', prepare: async (p) => void (await expect(p.getByTestId('poker-table')).toBeVisible()) },
  { name: 'settings', path: '/#/settings', prepare: async (p) => void (await expect(p.getByTestId('settings')).toBeVisible()) },
];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const s of SCREENS) {
      test(`${s.name} ${width} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        if (s.onboarding) {
          await page.goto(s.path);
          await expect(page.getByTestId('onboarding')).toBeVisible();
        } else {
          await open(page, s.path);
          await s.prepare?.(page);
        }
        // Viewport-sized shots: sticky bars appear where they really are. Screens with feedback
        // are scrolled so the table and the coaching card are in view.
        if (s.scrollTo) await page.getByTestId(s.scrollTo).first().scrollIntoViewIfNeeded();
        if (s.scrollTo) await page.evaluate(() => window.scrollBy(0, -120));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${OUT}/${s.name}-${width}-${theme}.png` });
      });
    }
  }
}
