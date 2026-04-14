import { expect, test } from '@playwright/test';

test.describe('Landing suite', () => {
  test('Landing title', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto('/', { timeout: 10000, waitUntil: 'domcontentloaded' });
    await expect(page.locator('#landing-title')).toBeVisible();
    await expect(page.locator('#landing-title')).not.toHaveText('');

    await context.close();
  });

  test('Landing CTAs navigate to the current auth flows', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    await page.goto('/', { timeout: 10000, waitUntil: 'domcontentloaded' });

    await expect(page.getByText('BUY EXPLORER')).toBeVisible();
    await expect(page.locator('form')).toContainText('Send Message');

    await page.locator('button').filter({ hasText: 'Reconnect with 4o' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/', { timeout: 10000, waitUntil: 'domcontentloaded' });
    await page.locator('button').filter({ hasText: 'Bring Memories Home' }).click();
    await expect(page).toHaveURL(/\/register$/);

    await context.close();
  });
});
