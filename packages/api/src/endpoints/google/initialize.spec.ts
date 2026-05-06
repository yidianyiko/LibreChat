import { EModelEndpoint, AuthKeys } from 'librechat-data-provider';
import type { BaseInitializeParams } from '~/types';

const mockGetGoogleConfig = jest.fn().mockReturnValue({
  llmConfig: { model: 'gemini-test' },
  tools: [],
});

const mockLoadServiceKey = jest.fn();

jest.mock('./llm', () => ({
  getGoogleConfig: (...args: unknown[]) => mockGetGoogleConfig(...args),
}));

jest.mock('~/utils', () => ({
  isEnabled: jest.fn(),
  loadServiceKey: (...args: unknown[]) => mockLoadServiceKey(...args),
  checkUserKeyExpiry: jest.fn(),
}));

import { initializeGoogle } from './initialize';

const createParams = (): BaseInitializeParams => {
  const db = {
    getUserKey: jest.fn().mockResolvedValue(
      JSON.stringify({
        [AuthKeys.GOOGLE_API_KEY]: 'user-google-key',
      }),
    ),
    getUserKeyValues: jest.fn(),
  } as unknown as BaseInitializeParams['db'];

  return {
    req: {
      user: { id: 'user-1' },
      body: { key: '2099-01-01' },
      config: { endpoints: {} },
    } as unknown as BaseInitializeParams['req'],
    endpoint: EModelEndpoint.google,
    model_parameters: { model: 'gemini-test' },
    db,
  };
};

describe('initializeGoogle', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_SERVICE_KEY_FILE;
    mockLoadServiceKey.mockResolvedValue(null);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not load user-provided Google credentials when GOOGLE_KEY is user_provided', async () => {
    process.env.GOOGLE_KEY = 'user_provided';
    const params = createParams();

    await initializeGoogle(params);

    expect(params.db.getUserKey).not.toHaveBeenCalled();
    expect(mockGetGoogleConfig).toHaveBeenCalledWith(
      {
        [AuthKeys.GOOGLE_SERVICE_KEY]: {},
        [AuthKeys.GOOGLE_API_KEY]: undefined,
      },
      expect.any(Object),
    );
  });

  it('uses server Google API key when configured', async () => {
    process.env.GOOGLE_KEY = 'server-google-key';
    const params = createParams();

    await initializeGoogle(params);

    expect(params.db.getUserKey).not.toHaveBeenCalled();
    expect(mockGetGoogleConfig).toHaveBeenCalledWith(
      {
        [AuthKeys.GOOGLE_SERVICE_KEY]: {},
        [AuthKeys.GOOGLE_API_KEY]: 'server-google-key',
      },
      expect.any(Object),
    );
  });

  it('uses server Google service account when no API key is configured', async () => {
    const serviceKey = { project_id: 'server-project' };
    mockLoadServiceKey.mockResolvedValue(serviceKey);
    const params = createParams();

    await initializeGoogle(params);

    expect(params.db.getUserKey).not.toHaveBeenCalled();
    expect(mockGetGoogleConfig).toHaveBeenCalledWith(
      {
        [AuthKeys.GOOGLE_SERVICE_KEY]: serviceKey,
        [AuthKeys.GOOGLE_API_KEY]: undefined,
      },
      expect.any(Object),
    );
  });
});
