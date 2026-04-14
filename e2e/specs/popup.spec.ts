import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function dismissUpdateBanner(page: Page) {
  const cancelButton = page.getByRole('status').getByRole('button', { name: 'Cancel' });
  await cancelButton.click({ timeout: 2000 }).catch(() => {});
}

test.describe('Endpoints Presets suite', () => {
  test('Model picker updates the selected model', async ({ page }) => {
    await page.goto('/c/new', { timeout: 10000 });
    await dismissUpdateBanner(page);

    const modelButton = page.getByRole('button', { name: /select a model/i });
    await expect(modelButton).toHaveText('GPT-4o (2024-11-20)');

    await modelButton.click({ force: true });
    await page.getByRole('option', { name: 'OpenAI' }).click();
    await page.locator('[role="option"]').filter({ hasText: 'gpt-3.5-turbo' }).first().click();

    await expect(modelButton).toHaveText('gpt-3.5-turbo');
  });
});
