import { expect, type Page } from '@playwright/test';

/** Open a page in a fresh profile and skip the first-run onboarding. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  const dialog = page.getByTestId('onboarding');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Skip' }).click();
  await expect(dialog).toBeHidden();
}
