import jwt from 'jsonwebtoken';
import type { NextFunction, Response } from 'express';
import type { ServerRequest } from '~/types/http';
import type { AdminConversationReviewConfig } from '../config';
import {
  ADMIN_CONVO_COOKIE_NAME,
  createElevatedConvoToken,
  requireElevatedConvoAccess,
} from '../elevatedAuth';

const config: AdminConversationReviewConfig = {
  hashSalt: '12345678901234567890123456789012',
  passwordHash: '$2b$12$123456789012345678901u12345678901234567890123456789012',
  passwordVersion: 3,
  sessionSecret: 'abcdefghijklmnopqrstuvwxyz123456',
  secureCookie: true,
};

type MockResponse = Response & {
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(body: { error: string }) => MockResponse>;
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

const createRequest = (cookie?: string, userId = 'admin-1'): ServerRequest =>
  ({
    cookies: cookie ? { [ADMIN_CONVO_COOKIE_NAME]: cookie } : {},
    user: { _id: { toString: () => userId } },
  }) as ServerRequest;

const expectAuthenticationRequired = (
  res: MockResponse,
  next: jest.MockedFunction<NextFunction>,
) => {
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
  expect(next).not.toHaveBeenCalled();
};

describe('requireElevatedConvoAccess', () => {
  it('returns 401 when the elevated session cookie is missing', () => {
    const req = createRequest();
    const res = createResponse();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    requireElevatedConvoAccess(config)(req, res, next);

    expectAuthenticationRequired(res, next);
    expect(res.status).toHaveBeenCalledTimes(1);
  });

  it('calls next for a valid elevated session cookie', () => {
    const token = createElevatedConvoToken(config, 'admin-1');
    const req = createRequest(token);
    const res = createResponse();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    requireElevatedConvoAccess(config)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when the elevated session token is expired', () => {
    const token = jwt.sign(
      { scope: 'admin.conversations', adminId: 'admin-1', pwVersion: config.passwordVersion },
      config.sessionSecret,
      { expiresIn: '-1s' },
    );
    const req = createRequest(token);
    const res = createResponse();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    requireElevatedConvoAccess(config)(req, res, next);

    expectAuthenticationRequired(res, next);
    expect(res.status).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when the elevated session token scope is wrong', () => {
    const token = jwt.sign(
      { scope: 'admin.other', adminId: 'admin-1', pwVersion: config.passwordVersion },
      config.sessionSecret,
      { expiresIn: '15m' },
    );
    const req = createRequest(token);
    const res = createResponse();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    requireElevatedConvoAccess(config)(req, res, next);

    expectAuthenticationRequired(res, next);
    expect(res.status).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when the elevated session token admin id does not match the request user', () => {
    const token = createElevatedConvoToken(config, 'admin-2');
    const req = createRequest(token, 'admin-1');
    const res = createResponse();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    requireElevatedConvoAccess(config)(req, res, next);

    expectAuthenticationRequired(res, next);
    expect(res.status).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when the elevated session token has an old password version', () => {
    const token = jwt.sign(
      { scope: 'admin.conversations', adminId: 'admin-1', pwVersion: 2 },
      config.sessionSecret,
      { expiresIn: '15m' },
    );
    const req = createRequest(token);
    const res = createResponse();
    const next = jest.fn() as jest.MockedFunction<NextFunction>;

    requireElevatedConvoAccess(config)(req, res, next);

    expectAuthenticationRequired(res, next);
    expect(res.status).toHaveBeenCalledTimes(1);
  });
});
