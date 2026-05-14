import { parseAdminConversationReviewConfig } from '../config';

const validEnv = {
  NODE_ENV: 'production',
  ADMIN_HASH_SALT: '12345678901234567890123456789012',
  ADMIN_CONVERSATIONS_PASSWORD_HASH:
    '$2b$12$123456789012345678901u12345678901234567890123456789012',
  ADMIN_CONVERSATIONS_PASSWORD_VERSION: '1',
  ADMIN_CONVO_SESSION_SECRET: 'abcdefghijklmnopqrstuvwxyz123456',
};

describe('parseAdminConversationReviewConfig', () => {
  it('parses a valid production admin conversation config', () => {
    expect(parseAdminConversationReviewConfig(validEnv)).toEqual({
      hashSalt: validEnv.ADMIN_HASH_SALT,
      passwordHash: validEnv.ADMIN_CONVERSATIONS_PASSWORD_HASH,
      passwordVersion: 1,
      sessionSecret: validEnv.ADMIN_CONVO_SESSION_SECRET,
      secureCookie: true,
    });
  });

  it('rejects a short hash salt', () => {
    expect(() =>
      parseAdminConversationReviewConfig({
        ...validEnv,
        ADMIN_HASH_SALT: 'short',
      }),
    ).toThrow('ADMIN_HASH_SALT must be at least 32 bytes');
  });

  it('rejects a missing hash salt', () => {
    const { ADMIN_HASH_SALT: _hashSalt, ...env } = validEnv;

    expect(() => parseAdminConversationReviewConfig(env)).toThrow('ADMIN_HASH_SALT is required');
  });

  it('rejects a plaintext password hash', () => {
    expect(() =>
      parseAdminConversationReviewConfig({
        ...validEnv,
        ADMIN_CONVERSATIONS_PASSWORD_HASH: 'plaintext-password',
      }),
    ).toThrow('ADMIN_CONVERSATIONS_PASSWORD_HASH must be a bcrypt hash');
  });

  it('rejects a zero password version', () => {
    expect(() =>
      parseAdminConversationReviewConfig({
        ...validEnv,
        ADMIN_CONVERSATIONS_PASSWORD_VERSION: '0',
      }),
    ).toThrow('ADMIN_CONVERSATIONS_PASSWORD_VERSION must be a positive integer');
  });

  it('rejects a malformed password version', () => {
    expect(() =>
      parseAdminConversationReviewConfig({
        ...validEnv,
        ADMIN_CONVERSATIONS_PASSWORD_VERSION: 'abc',
      }),
    ).toThrow('ADMIN_CONVERSATIONS_PASSWORD_VERSION must be a positive integer');
  });

  it('rejects a short session secret', () => {
    expect(() =>
      parseAdminConversationReviewConfig({
        ...validEnv,
        ADMIN_CONVO_SESSION_SECRET: 'short',
      }),
    ).toThrow('ADMIN_CONVO_SESSION_SECRET must be at least 32 bytes');
  });

  it('allows an insecure cookie override only for local non-production config', () => {
    expect(
      parseAdminConversationReviewConfig({
        ...validEnv,
        NODE_ENV: 'development',
        ADMIN_CONVO_COOKIE_SECURE: 'false',
      }).secureCookie,
    ).toBe(false);
  });

  it('rejects an insecure cookie override in production', () => {
    expect(() =>
      parseAdminConversationReviewConfig({
        ...validEnv,
        ADMIN_CONVO_COOKIE_SECURE: 'false',
      }),
    ).toThrow('ADMIN_CONVO_COOKIE_SECURE=false is only allowed outside production');
  });
});
