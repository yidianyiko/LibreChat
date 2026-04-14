import path from 'path';
import { test } from '@playwright/test';

import { authenticatePage } from '../setup/authenticate';
import localUser from '../config.local';

const storageStatePath = path.resolve(process.cwd(), 'e2e/storageState.json');

test('authenticate local user', async ({ page, baseURL }) => {
  if (!baseURL) {
    throw new Error('baseURL is required');
  }

  await authenticatePage(page, localUser, baseURL, storageStatePath);
});
