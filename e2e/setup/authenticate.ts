import { chromium } from '@playwright/test';
import type { FullConfig, Page } from '@playwright/test';
import type { User } from '../types';
import cleanupUser from './cleanupUser';
import dotenv from 'dotenv';
dotenv.config();

const timeout = 10000;

async function register(page: Page, user: User, baseURL: string) {
  await page.goto(`${baseURL}/register`, { timeout });
  await page.getByLabel('Full name').click();
  await page.getByLabel('Full name').fill(user.name);
  await page.getByText('Username (optional)').click();
  await page.getByLabel('Username (optional)').fill('test');
  await page.getByLabel('Email').click();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Email').press('Tab');
  await page.getByTestId('password').click();
  await page.getByTestId('password').fill(user.password);
  await page.getByTestId('confirm_password').click();
  await page.getByTestId('confirm_password').fill(user.password);
  await page.getByLabel('Submit registration').click();
}

async function login(page: Page, user: User, baseURL: string) {
  await page.goto(`${baseURL}/login?redirect_to=%2Fc%2Fnew`, { timeout });
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByLabel(/terms of service/i).check();
  await page.getByRole('button', { name: /continue/i }).click();
}

async function hasVisibleRegistrationError(page: Page) {
  const registrationError = page.getByTestId('registration-error');
  if ((await registrationError.count()) === 0) {
    return false;
  }

  return registrationError.isVisible();
}

export async function authenticatePage(
  page: Page,
  user: User,
  baseURL: string,
  storageStatePath: string,
) {
  console.log('🤖: using baseURL', baseURL);
  console.dir(user, { depth: null });
  console.log('🤖: 🗝  authenticating user:', user.email);

  // Set localStorage before navigating to the page
  await page.context().addInitScript(() => {
    localStorage.setItem('navVisible', 'true');
  });
  console.log('🤖: ✔️  localStorage: set Nav as Visible', storageStatePath);

  await register(page, user, baseURL);
  if (await hasVisibleRegistrationError(page)) {
    console.log('🤖: 🚨  user already exists');
    await cleanupUser(user);
    await register(page, user, baseURL);
  }
  console.log('🤖: ✔️  user successfully registered');

  if (page.url() !== `${baseURL}/c/new`) {
    await login(page, user, baseURL);
    await page.waitForURL(`${baseURL}/c/new`, { timeout });
  }
  console.log('🤖: ✔️  user successfully authenticated');

  await page.context().storageState({ path: storageStatePath });
  console.log('🤖: ✔️  authentication state successfully saved in', storageStatePath);
}

async function authenticate(config: FullConfig, user: User) {
  console.log('🤖: global setup has been started');
  const { baseURL, storageState } = config.projects[0].use;

  if (!baseURL || typeof storageState !== 'string') {
    throw new Error('🤖: baseURL or storageState is not defined');
  }

  const browser = await chromium.launch({
    headless: false,
  });

  try {
    const page = await browser.newPage();
    await authenticatePage(page, user, baseURL, storageState);
  } finally {
    await browser.close();
    console.log('🤖: global setup has been finished');
  }
}

export default authenticate;
