import { expect, test } from '@playwright/test';

// Data migration (D-093): a database written by the first trainer release (Dexie version 1:
// answers, families, settings) opens in the current app without losing anything; Dexie adds the
// newer tables (lessons, math, placement, notes, journal) around it.
test('a version-1 database upgrades to the current schema with its data intact', async ({ page }) => {
  // Write a version-1 database (Dexie version v => IndexedDB version 10 x v) before the app ever
  // runs: a static file on the same origin gives the page IndexedDB without loading the app, so
  // no open connection can block or race the seeding (it did on CI).
  await page.goto('/favicon.svg');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('openrange-trainer', 10);
      req.onupgradeneeded = () => {
        const db = req.result;
        const answers = db.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
        answers.createIndex('at', 'at');
        answers.createIndex('drill', 'drill');
        answers.createIndex('family', 'family');
        db.createObjectStore('families', { keyPath: 'family' });
        db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['answers', 'families', 'settings'], 'readwrite');
        tx.objectStore('answers').add({ at: Date.now(), drill: 'preflop', graded: true, family: 'preflop|pushfold-hu|sb-shove|8-14', reference: { file: 'pushfold-hu.json', chart: 'sb-shove-10' }, hand: 'AhKd', handClass: 'AKo', actions: ['Fold', 'All-in'], chosen: 1, unit: 'bb', category: 'best', loss: 0, gradedLoss: 0, groups: { drill: 'preflop', position: 'SB' } });
        tx.objectStore('families').put({ family: 'preflop|pushfold-hu|sb-shove|8-14', ease: 2.6, repetitions: 1, intervalDays: 1, due: 0, lapses: 0, answers: 1 });
        tx.objectStore('settings').put({ key: 'app', value: { onboarded: true, display: { theme: 'dark' } } });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.goto('/#/stats');
  // The old answer and settings are there (no onboarding: it was already done).
  await expect(page.getByTestId('review-summary')).toContainText('1 answers on this device');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // The upgraded database has every current table, and new features can write to it.
  const stores = await page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('openrange-trainer');
        req.onsuccess = () => {
          const names = [...req.result.objectStoreNames];
          req.result.close();
          resolve(names);
        };
      }),
  );
  expect(stores.sort()).toEqual(['answers', 'families', 'journal', 'lessons', 'math', 'notes', 'placement', 'settings']);
  await page.goto('/#/play/journal');
  await page.getByTestId('journal-goal').getByLabel('Your process goal for this session').fill('Stay patient');
  await page.getByTestId('journal-goal').getByRole('button', { name: 'Save goal' }).click();
  await expect(page.getByTestId('journal-entries')).toContainText('Goal: Stay patient');
});
