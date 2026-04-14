import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const conversationPath = '/c/';
const initialUrl = '/c/new';
const persistedConversationUrl = /\/c\/[^/?#]+$/;
const stopGeneratingButton = { name: 'Stop generating', exact: true } as const;

function getUserMessageContent(page: Page, message: string) {
  return page.locator('.user-turn .message-content').filter({ hasText: message }).first();
}

async function waitForGenerationToFinish(page: Page) {
  await expect(page.getByRole('button', stopGeneratingButton)).toBeHidden({ timeout: 60000 });
  await expect(page.getByTestId('send-button')).toBeVisible({ timeout: 10000 });
}

async function dismissUpdateBanner(page: Page) {
  const cancelButton = page.getByRole('status').getByRole('button', { name: 'Cancel' });
  await cancelButton.click({ timeout: 2000 }).catch(() => {});
}

async function sendMessage(page: Page, message: string) {
  await page.goto(initialUrl, { timeout: 20000, waitUntil: 'domcontentloaded' });
  await dismissUpdateBanner(page);
  await page.getByTestId('text-input').fill(message);

  await page.getByTestId('send-button').click();
  await expect(page).toHaveURL(persistedConversationUrl, { timeout: 15000 });
  await expect(page.getByTestId('text-input')).toHaveValue('', { timeout: 15000 });
  await waitForGenerationToFinish(page);
  await expect(getUserMessageContent(page, message)).toHaveText(message, { timeout: 10000 });
}

async function expandChatsIfNeeded(page: Page) {
  const conversations = page.getByTestId('convo-item');
  const conversationCount = await conversations.count();
  if (conversationCount > 0) {
    return;
  }

  await page.getByRole('button', { name: 'Chats' }).click();
}

test.describe('Messaging suite', () => {
  test('sending a message creates a conversation that can be reopened', async ({ page }) => {
    const message = `e2e-navigation-${Date.now()}`;
    await sendMessage(page, message);

    const isTextboxFocused = await page.evaluate(() => {
      return document.activeElement === document.querySelector('[data-testid="text-input"]');
    });
    expect(isTextboxFocused).toBeTruthy();

    await expect(getUserMessageContent(page, message)).toHaveText(message);

    await page.getByTestId('nav-new-chat-button').click();
    await expect(page).toHaveURL(/\/c\/new$/);

    await expandChatsIfNeeded(page);
    const firstConversation = page.getByTestId('convo-item').first();
    await expect(firstConversation).toBeVisible({ timeout: 10000 });
    await firstConversation.click({ timeout: 5000 });
    await expect(page).toHaveURL(persistedConversationUrl);
    expect(page.url()).not.toContain(conversationPath + 'new');
    await expect(getUserMessageContent(page, message)).toHaveText(message);
  });

  test('editing a message updates the visible content', async ({ page }) => {
    const message = `e2e-edit-${Date.now()}`;
    const editedMessage = `edited-${Date.now()}`;

    await sendMessage(page, message);

    await page.getByRole('button', { name: /edit/i }).first().click();
    const textEditor = page.getByTestId('message-text-editor');
    await textEditor.fill(editedMessage);
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText(editedMessage, { exact: true }).first()).toBeVisible();
  });
});
