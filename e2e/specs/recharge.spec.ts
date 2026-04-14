import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function openRecharge(page: Page) {
  await page.goto('/c/new', { timeout: 10000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('nav-user').click({ force: true });
  const addCreditsButton = page.getByRole('button', { name: '+ Add Credits' });
  await expect(addCreditsButton).toBeVisible();
  await addCreditsButton.click({ force: true });
  await expect(page).toHaveURL(/\/recharge$/);
}

test.describe('Recharge Flow', () => {
  test('should display pricing tiers on recharge page', async ({ page }) => {
    await openRecharge(page);

    await expect(page.getByText('Recharge Your Token Credits')).toBeVisible();

    const pricingCards = page.locator('[data-testid="pricing-card"]');
    await expect(pricingCards).toHaveCount(3);

    const firstCard = pricingCards.first();
    await expect(firstCard).toContainText('$4.99');
    await expect(firstCard).toContainText('BUY EXPLORER');
  });

  test('should show payment cancel message', async ({ page }) => {
    await page.goto('/recharge/cancel', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Payment Cancelled' })).toBeVisible();
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should display recharge history', async ({ page }) => {
    await page.goto('/recharge/history', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Recharge History' })).toBeVisible();

    const emptyState = page.locator('text=No recharge history yet');
    const historyTable = page.locator('table');

    expect((await emptyState.isVisible()) || (await historyTable.isVisible())).toBe(true);
  });
});
