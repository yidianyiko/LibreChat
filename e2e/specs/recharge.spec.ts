import { test, expect } from '@playwright/test';

test.describe('Recharge Flow', () => {
  test('should display pricing tiers on recharge page', async ({ page }) => {
    await page.goto('http://localhost:3080/recharge');

    await expect(page.locator('h1')).toContainText('Recharge Your Credits');

    const pricingCards = page.locator('[data-testid="pricing-card"]');
    await expect(pricingCards).toHaveCount(5);

    const firstCard = pricingCards.first();
    await expect(firstCard).toContainText('$5');
    await expect(firstCard).toContainText('Purchase');
  });

  test('should navigate to recharge from navigation button', async ({ page }) => {
    await page.goto('http://localhost:3080/');

    await page.getByTestId('nav-user').click();
    await page.click('button:has-text("Add Credits")');

    await expect(page).toHaveURL('http://localhost:3080/recharge');
  });

  test('should show payment cancel message', async ({ page }) => {
    await page.goto('http://localhost:3080/recharge/cancel');

    await expect(page.locator('h1')).toContainText('Payment Cancelled');
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
  });

  test('should display recharge history', async ({ page }) => {
    await page.goto('http://localhost:3080/recharge/history');

    await expect(page.locator('h1')).toContainText('Recharge History');

    const emptyState = page.locator('text=No recharge history yet');
    const historyTable = page.locator('table');

    expect((await emptyState.isVisible()) || (await historyTable.isVisible())).toBe(true);
  });
});
