const mockGetAppConfig = jest.fn();
jest.mock('~/server/services/Config/app', () => ({
  getAppConfig: (...args) => mockGetAppConfig(...args),
}));

jest.mock('~/server/services/Config/ldap', () => ({
  getLdapConfig: jest.fn(() => null),
}));

const mockGetProjectByName = jest.fn();
jest.mock('~/models/Project', () => ({
  getProjectByName: (...args) => mockGetProjectByName(...args),
}));

const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockGetLogStores = jest.fn(() => ({
  get: mockCacheGet,
  set: mockCacheSet,
}));
jest.mock('~/cache', () => ({
  getLogStores: (...args) => mockGetLogStores(...args),
}));

const request = require('supertest');
const express = require('express');
const configRoute = require('../config');

function createApp(user = null) {
  const app = express();
  app.disable('x-powered-by');
  if (user) {
    app.use((req, _res, next) => {
      req.user = user;
      next();
    });
  }
  app.use('/api/config', configRoute);
  return app;
}

const baseAppConfig = {
  registration: { socialLogins: ['google', 'github'] },
  interfaceConfig: {},
  turnstileConfig: undefined,
  modelSpecs: undefined,
  webSearch: undefined,
};

describe('GET /api/config allowAccountDeletion', () => {
  beforeEach(() => {
    mockGetLogStores.mockImplementation(() => ({
      get: mockCacheGet,
      set: mockCacheSet,
    }));
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockGetAppConfig.mockResolvedValue(baseAppConfig);
    mockGetProjectByName.mockResolvedValue({ _id: { toString: () => 'project-123' } });
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.ALLOW_ACCOUNT_DELETION;
  });

  it('defaults allowAccountDeletion to true when env var is unset', async () => {
    const response = await request(createApp()).get('/api/config');

    expect(response.statusCode).toBe(200);
    expect(response.body.allowAccountDeletion).toBe(true);
  });

  it('sets allowAccountDeletion to false when ALLOW_ACCOUNT_DELETION=false', async () => {
    process.env.ALLOW_ACCOUNT_DELETION = 'false';

    const response = await request(createApp()).get('/api/config');

    expect(response.statusCode).toBe(200);
    expect(response.body.allowAccountDeletion).toBe(false);
  });

  it('sets allowAccountDeletion to true when ALLOW_ACCOUNT_DELETION=true', async () => {
    process.env.ALLOW_ACCOUNT_DELETION = 'true';

    const response = await request(createApp()).get('/api/config');

    expect(response.statusCode).toBe(200);
    expect(response.body.allowAccountDeletion).toBe(true);
  });
});
