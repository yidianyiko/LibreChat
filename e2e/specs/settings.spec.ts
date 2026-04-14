import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function dismissUpdateBanner(page: Page) {
  const cancelButton = page.getByRole('status').getByRole('button', { name: 'Cancel' });
  await cancelButton.click({ timeout: 2000 }).catch(() => {});
}

async function selectModel(page: Page, provider: string, model: string) {
  await dismissUpdateBanner(page);
  await page.getByRole('button', { name: /select a model/i }).click();
  await page.getByRole('option', { name: provider }).click();
  await page.locator('[role="option"]').filter({ hasText: model }).first().click();
}

test.describe('Settings suite', () => {
  test('Selected model persists after reload', async ({ page }) => {
    await page.goto('/c/new', { timeout: 20000, waitUntil: 'domcontentloaded' });

    await selectModel(page, 'OpenAI', 'gpt-3.5-turbo');
    const modelButton = page.getByRole('button', { name: /select a model/i });
    await expect(modelButton).toHaveText('gpt-3.5-turbo');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await dismissUpdateBanner(page);
    await expect(modelButton).toHaveText('gpt-3.5-turbo');
  });
});
