import path from 'path';
import { devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import mainConfig from './playwright.config';
import dotenv from 'dotenv';
dotenv.config();

const authFile = path.resolve(process.cwd(), 'e2e/storageState.json');
const mainWebServer =
  mainConfig.webServer != null && !Array.isArray(mainConfig.webServer) ? mainConfig.webServer : {};
const { port: inheritedPort, env: mainWebServerEnv, ...mainWebServerConfig } = mainWebServer;
void inheritedPort;

const config: PlaywrightTestConfig = {
  ...mainConfig,
  retries: 0,
  globalSetup: undefined,
  globalTeardown: require.resolve('./setup/global-teardown.local'),
  use: {
    ...mainConfig.use,
    baseURL: 'http://127.0.0.1:3180',
    storageState: authFile,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'chromium',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
    },
  ],
  webServer: {
    ...mainWebServerConfig,
    url: 'http://127.0.0.1:3180/health',
    reuseExistingServer: false,
    env: {
      ...mainWebServerEnv,
      ...process.env,
      PORT: '3180',
      DOMAIN_CLIENT: 'http://127.0.0.1:3180',
      DOMAIN_SERVER: 'http://127.0.0.1:3180',
      CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3180',
      SSE_ALLOWED_ORIGINS: 'http://127.0.0.1:3180',
      SEARCH: 'false',
      NODE_ENV: 'CI',
      EMAIL_HOST: '',
      TITLE_CONVO: 'false',
      SESSION_EXPIRY: '60000',
      REFRESH_TOKEN_EXPIRY: '300000',
      LOGIN_VIOLATION_SCORE: '0',
      REGISTRATION_VIOLATION_SCORE: '0',
      CONCURRENT_VIOLATION_SCORE: '0',
      MESSAGE_VIOLATION_SCORE: '0',
      NON_BROWSER_VIOLATION_SCORE: '0',
      FORK_VIOLATION_SCORE: '0',
      IMPORT_VIOLATION_SCORE: '0',
      TTS_VIOLATION_SCORE: '0',
      STT_VIOLATION_SCORE: '0',
      FILE_UPLOAD_VIOLATION_SCORE: '0',
      RESET_PASSWORD_VIOLATION_SCORE: '0',
      VERIFY_EMAIL_VIOLATION_SCORE: '0',
      TOOL_CALL_VIOLATION_SCORE: '0',
      CONVO_ACCESS_VIOLATION_SCORE: '0',
      ILLEGAL_MODEL_REQ_SCORE: '0',
      LOGIN_MAX: '20',
      LOGIN_WINDOW: '1',
      REGISTER_MAX: '20',
      REGISTER_WINDOW: '1',
      LIMIT_CONCURRENT_MESSAGES: 'false',
      CONCURRENT_MESSAGE_MAX: '20',
      LIMIT_MESSAGE_IP: 'false',
      MESSAGE_IP_MAX: '100',
      MESSAGE_IP_WINDOW: '1',
      LIMIT_MESSAGE_USER: 'false',
      MESSAGE_USER_MAX: '100',
      MESSAGE_USER_WINDOW: '1',
    },
  },
  fullyParallel: false,
  workers: 1,
  // testMatch: /messages/,
  // retries: 0,
};

export default config;
