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
jest.mock('~/cache', () => ({
  getLogStores: () => ({
    get: mockCacheGet,
    set: mockCacheSet,
  }),
}));

const jwt = require('jsonwebtoken');
const express = require('express');
const passport = require('passport');
const request = require('supertest');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const configRoute = require('../config');

const JWT_SECRET = 'test-jwt-secret';
const testUser = { id: 'user-123', role: 'USER' };

const appConfig = {
  registration: { socialLogins: ['google'] },
  interfaceConfig: { modelSelect: true, endpointsMenu: true },
  turnstileConfig: undefined,
  webSearch: undefined,
  modelSpecs: {
    prioritize: true,
    list: [
      {
        name: 'gpt-5.5',
        label: 'GPT-5.5',
        preset: { endpoint: 'openAI', model: 'gpt-5.5' },
      },
    ],
  },
};

/** Mirrors the production mount in `api/server/index.js`: no user injection middleware. */
function createProductionLikeApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(passport.initialize());
  app.use('/api/config', configRoute);
  return app;
}

describe('GET /api/config authenticated payload', () => {
  beforeAll(() => {
    passport.use(
      'jwt',
      new JwtStrategy(
        {
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
          secretOrKey: JWT_SECRET,
        },
        (payload, done) => done(null, { id: payload.id, role: payload.role }),
      ),
    );
  });

  beforeEach(() => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockGetAppConfig.mockResolvedValue(appConfig);
    mockGetProjectByName.mockResolvedValue({ _id: { toString: () => 'project-123' } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns model specs and interface config to a bearer-token caller', async () => {
    const token = jwt.sign({ id: testUser.id, role: testUser.role }, JWT_SECRET, {
      expiresIn: '5m',
    });

    const response = await request(createProductionLikeApp())
      .get('/api/config')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.modelSpecs?.list).toHaveLength(1);
    expect(response.body.modelSpecs.list[0].name).toBe('gpt-5.5');
    expect(response.body.interface).toEqual(appConfig.interfaceConfig);
  });

  it('still withholds post-login fields from anonymous callers', async () => {
    const response = await request(createProductionLikeApp()).get('/api/config');

    expect(response.statusCode).toBe(200);
    expect(response.body.modelSpecs).toBeUndefined();
    expect(response.body.interface).toBeUndefined();
    expect(response.body.appTitle).toBeDefined();
  });
});
