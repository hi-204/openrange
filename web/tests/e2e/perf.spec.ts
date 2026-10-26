// Performance budgets (docs/PLAN.md, M10): with the CPU slowed 4× to stand in for a mid-range
// laptop, the app starts in under 3 s, a lesson opens in under 2 s, a river spot solves in
// under 5 s, and no task blocks the page for 200 ms or more while it solves and shows the
// result (the solver runs in a worker).
import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('performance budgets with a 4× slower CPU', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CPU throttling needs Chromium');
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const results: Record<string, number> = {};

  let t = Date.now();
  await open(page, '/');
  await expect(page.getByTestId('daily-plan')).toBeVisible();
  results.startMs = Date.now() - t;

  t = Date.now();
  await page.goto('/#/learn/4.9');
  await expect(page.getByTestId('lesson')).toContainText('Sizing basics');
  results.lessonMs = Date.now() - t;

  await page.goto('/#/solver');
  await page.getByLabel('Target exploitability (% of pot)').fill('0.3');
  // While it solves, the page must stay responsive: record the browser's long tasks (> 50 ms).
  await page.evaluate(() => {
    const w = window as unknown as { longTasks: number[] };
    w.longTasks = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.longTasks.push(e.duration))).observe({ type: 'longtask' });
  });
  t = Date.now();
  await page.getByRole('button', { name: 'Solve' }).click();
  await expect(page.getByTestId('node-browser')).toContainText('OOP to act', { timeout: 30_000 });
  results.riverSolveMs = Date.now() - t;
  await page.waitForTimeout(500);
  results.longestTaskMs = Math.round(await page.evaluate(() => Math.max(0, ...(window as unknown as { longTasks: number[] }).longTasks)));
  console.log(`perf (4× CPU): ${JSON.stringify(results)}`);

  expect(results.startMs).toBeLessThan(3000);
  expect(results.lessonMs).toBeLessThan(2000);
  expect(results.riverSolveMs).toBeLessThan(5000);
  expect(results.longestTaskMs).toBeLessThan(200);
});
