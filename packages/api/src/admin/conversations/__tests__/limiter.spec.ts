import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { createAdminConvoLimiter } from '../limiter';
import { limiterCache } from '~/cache/cacheFactory';
import { removePorts } from '~/utils/ports';

jest.mock('express-rate-limit', () => jest.fn(() => 'admin-convo-limiter'));
jest.mock('~/cache/cacheFactory', () => ({
  limiterCache: jest.fn(() => 'admin-convo-store'),
}));
jest.mock('~/utils/ports', () => ({
  removePorts: jest.fn((req: Request) => req.ip?.replace(/:\d+$/, '')),
}));

type RateLimitOptions = {
  windowMs: number;
  max: number;
  store: string;
  keyGenerator: (req: Request) => string;
  handler: (req: Request, res: Response) => Response;
};

type MockResponse = Response & {
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(body: { error: string }) => MockResponse>;
};

const mockedRateLimit = rateLimit as unknown as jest.MockedFunction<
  (options: RateLimitOptions) => string
>;
const mockedLimiterCache = limiterCache as unknown as jest.MockedFunction<
  (prefix: string) => string
>;
const mockedRemovePorts = removePorts as jest.MockedFunction<(req: Request) => string | undefined>;

const getCapturedOptions = (): RateLimitOptions => {
  const options = mockedRateLimit.mock.calls[0]?.[0];

  if (!options) {
    throw new Error('rateLimit options were not captured');
  }

  return options;
};

const createResponse = (): MockResponse => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
};

describe('admin conversation limiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the admin user _id as the limiter key when present', () => {
    createAdminConvoLimiter();
    const options = getCapturedOptions();
    const req = {
      user: { _id: { toString: () => 'admin-1' } },
      ip: '203.0.113.10:12345',
    } as unknown as Request;

    expect(options.keyGenerator(req)).toBe('admin-1');
    expect(mockedRemovePorts).not.toHaveBeenCalled();
  });

  it('falls back to stripped IP when no user is present', () => {
    createAdminConvoLimiter();
    const options = getCapturedOptions();
    const req = { ip: '203.0.113.10:12345' } as Request;

    expect(options.keyGenerator(req)).toBe('203.0.113.10');
    expect(mockedRemovePorts).toHaveBeenCalledWith(req);
  });

  it('creates a 60 request per minute limiter with the admin conversation store and rate-limited handler', () => {
    expect(createAdminConvoLimiter()).toBe('admin-convo-limiter');

    expect(mockedLimiterCache).toHaveBeenCalledWith('admin_convo_limiter');
    expect(mockedRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60 * 1000,
        max: 60,
        store: 'admin-convo-store',
        keyGenerator: expect.any(Function),
      }),
    );

    const options = getCapturedOptions();
    const res = createResponse();
    options?.handler({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'rate_limited' });
  });
});
