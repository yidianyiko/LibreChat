const loadWithGoogleKey = async ({ googleKey, serviceKey }) => {
  jest.resetModules();
  jest.doMock('@librechat/api', () => ({
    isEnabled: (value) => value === 'true',
    isUserProvided: (value) => value === 'user_provided',
    loadServiceKey: jest.fn().mockResolvedValue(serviceKey),
  }));
  jest.doMock('@librechat/data-schemas', () => ({
    logger: { error: jest.fn() },
  }));

  if (googleKey === undefined) {
    delete process.env.GOOGLE_KEY;
  } else {
    process.env.GOOGLE_KEY = googleKey;
  }

  const loadAsyncEndpoints = require('./loadAsyncEndpoints');
  return await loadAsyncEndpoints();
};

describe('loadAsyncEndpoints', () => {
  const originalGoogleKey = process.env.GOOGLE_KEY;

  afterEach(() => {
    jest.dontMock('@librechat/api');
    jest.dontMock('@librechat/data-schemas');
    if (originalGoogleKey === undefined) {
      delete process.env.GOOGLE_KEY;
    } else {
      process.env.GOOGLE_KEY = originalGoogleKey;
    }
  });

  it('does not expose Google when only user-provided credentials are configured', async () => {
    const endpoints = await loadWithGoogleKey({ googleKey: 'user_provided' });

    expect(endpoints.google).toBe(false);
  });

  it('exposes Google when a server API key is configured', async () => {
    const endpoints = await loadWithGoogleKey({ googleKey: 'server-google-key' });

    expect(endpoints.google).toEqual({ userProvide: false });
  });

  it('exposes Google when a server service account key is configured', async () => {
    const endpoints = await loadWithGoogleKey({
      googleKey: undefined,
      serviceKey: { project_id: 'server-project' },
    });

    expect(endpoints.google).toEqual({ userProvide: false });
  });
});
