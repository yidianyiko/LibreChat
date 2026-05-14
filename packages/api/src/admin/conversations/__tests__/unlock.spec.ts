import bcrypt from 'bcryptjs';
import type { Response } from 'express';
import type { AdminConversationReviewConfig } from '../config';
import type { ServerRequest } from '~/types/http';
import { createAdminConvoLockoutStore, handleLock, handleUnlock } from '../unlock';
import { ADMIN_CONVO_COOKIE_NAME } from '../elevatedAuth';

const createConfig = (passwordHash: string): AdminConversationReviewConfig => ({
  hashSalt: '12345678901234567890123456789012',
  passwordHash,
  passwordVersion: 1,
  sessionSecret: 'abcdefghijklmnopqrstuvwxyz123456',
  secureCookie: false,
});

type JsonBody = { ok: true } | { error: string };

type MockResponse = Response & {
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(body: JsonBody) => MockResponse>;
  cookie: jest.MockedFunction<(name: string, value: string, options: object) => MockResponse>;
  clearCookie: jest.MockedFunction<(name: string, options: object) => MockResponse>;
  send: jest.MockedFunction<() => MockResponse>;
};

const createResponse = (): MockResponse => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    send: jest.fn(),
  } as unknown as MockResponse;

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.cookie.mockReturnValue(res);
  res.clearCookie.mockReturnValue(res);
  res.send.mockReturnValue(res);

  return res;
};

const createRequest = (password: string): ServerRequest =>
  ({
    body: { password },
    user: { _id: { toString: () => 'admin-1' } },
  }) as unknown as ServerRequest;

describe('admin conversation unlock and lock handlers', () => {
  it('returns 200 and sets the elevated cookie without exposing the token for the correct password', async () => {
    const config = createConfig(await bcrypt.hash('correct-password', 4));
    const req = createRequest('correct-password');
    const res = createResponse();
    const store = createAdminConvoLockoutStore();

    await handleUnlock(config, store)(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_CONVO_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
        path: '/api/admin/conversations',
        sameSite: 'strict',
        secure: false,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(JSON.stringify(res.json.mock.calls[0]?.[0])).not.toContain('token');
  });

  it('returns 401 without setting the elevated cookie for the wrong password', async () => {
    const config = createConfig(await bcrypt.hash('correct-password', 4));
    const req = createRequest('wrong-password');
    const res = createResponse();
    const store = createAdminConvoLockoutStore();

    await handleUnlock(config, store)(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('keeps the admin locked on the sixth attempt within 15 minutes even with the correct password', async () => {
    const config = createConfig(await bcrypt.hash('correct-password', 4));
    const store = createAdminConvoLockoutStore();

    for (let attempt = 0; attempt < 5; attempt++) {
      await handleUnlock(config, store)(createRequest('wrong-password'), createResponse());
    }

    const res = createResponse();
    await handleUnlock(config, store)(createRequest('correct-password'), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'authentication_required' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('clears the elevated cookie and returns 204 for lock', () => {
    const req = createRequest('');
    const res = createResponse();

    handleLock()(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      ADMIN_CONVO_COOKIE_NAME,
      expect.objectContaining({
        path: '/api/admin/conversations',
        sameSite: 'strict',
      }),
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
  });
});
