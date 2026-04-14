import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright'; // 1

async function dismissUpdateBanner(page: Page) {
  const cancelButton = page.getByRole('status').getByRole('button', { name: 'Cancel' });
  await cancelButton.click({ timeout: 2000 }).catch(() => {});
}

test('Landing page should not have any automatically detectable accessibility issues', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await page.goto('/', { timeout: 10000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#landing-title');

  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
  await context.close();
});

test('Conversation page should be accessible', async ({ page }) => {
  await page.goto('/c/new', { timeout: 10000, waitUntil: 'domcontentloaded' });
  await dismissUpdateBanner(page);
  await page.waitForSelector('[aria-label="Message input"]');

  const accessibilityScanResults = await new AxeBuilder({ page })
    .exclude('nav[aria-label="Chat History"]')
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
});

test('Navigation elements should be accessible', async ({ page }) => {
  await page.goto('/c/new', { timeout: 10000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('nav[aria-label="Chat History"]');

  const navAccessibilityScanResults = await new AxeBuilder({ page })
    .include('nav[aria-label="Chat History"]')
    .analyze();

  expect(navAccessibilityScanResults.violations).toEqual([]);
});

test('Input form should be accessible', async ({ page }) => {
  await page.goto('/c/new', { timeout: 10000, waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[aria-label="Message input"]');

  const formAccessibilityScanResults = await new AxeBuilder({ page })
    .include('[aria-label="Message input"]')
    .analyze();

  expect(formAccessibilityScanResults.violations).toEqual([]);
});
