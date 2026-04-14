import { expect, test } from '@playwright/test';

test.describe('Navigation suite', () => {
  test('Navigation bar opens the account menu', async ({ page }) => {
    await page.goto('/c/new', { timeout: 10000 });

    await page.getByTestId('nav-user').click();

    await expect(page.getByRole('group', { name: 'Account info' })).toContainText(
      'testuser@example.com',
    );
    await expect(page.getByRole('option', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Log out' })).toBeVisible();
  });

  test('Settings modal', async ({ page }) => {
    await page.goto('/c/new', { timeout: 10000 });
    await page.getByTestId('nav-user').click();
    await page.getByRole('option', { name: 'Settings' }).click();

    const modal = page.getByRole('dialog');
    await expect(modal).toContainText('Settings');
    await expect(modal.getByRole('tab', { name: 'General' })).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'Data controls' })).toBeVisible();
    await expect(page.getByTestId('theme-selector')).toBeVisible();

    await modal.getByRole('tab', { name: 'Data controls' }).click();
    await expect(modal).toContainText('Revoke all user provided credentials');
    await expect(modal).toContainText('Clear all chats');
  });
});
