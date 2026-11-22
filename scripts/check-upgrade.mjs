// Release upgrade check (D-096): serve an older release, use it (onboarding, one answer), then
// serve a newer release on the same address and reopen the app, as a user would. Checks that the
// page moves to the new version by itself, Train opens, and the saved answer is still there.
// Uses Playwright with the system Edge.
// Usage: node scripts/check-upgrade.mjs release/openrange-1.0.0 release/openrange-1.1.0 [port]
import { execSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const [dirA, dirB, port = '8094'] = process.argv.slice(2);
const url = `http://localhost:${port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const portBusy = () =>
  execSync('netstat -ano')
    .toString()
    .split(/\r?\n/)
    .some((l) => l.includes(`:${port} `) && l.includes('LISTENING'));

const serve = async (dir) => {
  const p = spawn(process.execPath, [`${dir}/serve.mjs`, '--port', port], { stdio: 'pipe' });
  await new Promise((res, rej) => {
    setTimeout(() => rej(new Error('server did not start')), 10000);
    p.stdout.on('data', (d) => (/running at/.test(String(d)) ? res() : console.log('server:', String(d).trim())));
    p.on('exit', (c) => rej(new Error(`server exited ${c}`)));
  });
  return p;
};
// Windows: kill the whole process tree and wait until the port is free again.
const stop = async (p) => {
  try {
    execSync(`taskkill /PID ${p.pid} /F /T`, { stdio: 'ignore' });
  } catch {}
  for (let i = 0; i < 50 && portBusy(); i++) await sleep(200);
  if (portBusy()) throw new Error('port still busy');
};
const version = (page) => page.evaluate(() => document.body.innerText.match(/OpenRange (\d+\.\d+\.\d+)\./)?.[1] ?? null);

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext();
const errors = [];
let page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
let a, b;
try {
  a = await serve(dirA);
  await page.goto(url + '#/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await sleep(3000);
  const vA = await version(page);
  // Save one answer in release A.
  await page.goto(url + '#/train/preflop');
  await page.getByTestId('preflop-question').waitFor({ timeout: 20000 });
  await page.locator('[aria-label="Actions"] button').first().click();
  await sleep(1500);
  await page.goto(url + '#/');
  console.log('A:', vA, await page.evaluate(() => caches.keys()));
  await stop(a);
  a = null;

  // Release B on the same address; the user opens the app in a new tab.
  b = await serve(dirB);
  await page.close();
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  let loads = 0;
  page.on('load', () => loads++);
  await page.goto(url + '#/');
  await sleep(10000);
  await page.waitForLoadState('load');
  console.log('B: page loads', loads, await page.evaluate(() => caches.keys()));
  await page.goto(url + '#/train/preflop');
  const trainOpens = await page.getByTestId('preflop-question').waitFor({ timeout: 20000 }).then(() => true, () => false);
  await page.goto(url + '#/stats');
  await sleep(2500);
  const summary = await page.getByTestId('review-summary').textContent().catch(() => null);
  await page.goto(url + '#/');
  await sleep(3000);
  const vB = await version(page);
  const crashed = await page.evaluate(() => /ran into a problem/.test(document.body.innerText));
  console.log(JSON.stringify({ vA, vB, trainOpens, crashed, summary, errors }, null, 1));
  const pass = vA !== vB && trainOpens && !crashed && /^1 answers/.test(summary ?? '') && errors.length === 0;
  console.log(pass ? 'check-upgrade: PASS' : 'check-upgrade: FAIL');
  if (!pass) process.exitCode = 1;
} finally {
  await browser.close();
  if (a) await stop(a);
  if (b) await stop(b);
}
