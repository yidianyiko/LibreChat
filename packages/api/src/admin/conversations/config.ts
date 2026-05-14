const BCRYPT_HASH_PREFIX = /^\$2[aby]\$\d{2}\$/;
const MIN_SECRET_BYTES = 32;

export type AdminConversationReviewConfig = {
  hashSalt: string;
  passwordHash: string;
  passwordVersion: number;
  sessionSecret: string;
  secureCookie: boolean;
};

type AdminConversationReviewEnv = Partial<Record<string, string>>;

const requireEnvValue = (env: AdminConversationReviewEnv, key: string): string => {
  const value = env[key];

  if (value) {
    return value;
  }

  throw new Error(`${key} is required`);
};

const requireMinimumBytes = (value: string, key: string): string => {
  if (Buffer.byteLength(value, 'utf8') >= MIN_SECRET_BYTES) {
    return value;
  }

  throw new Error(`${key} must be at least 32 bytes`);
};

const requireBcryptHash = (env: AdminConversationReviewEnv): string => {
  const passwordHash = requireEnvValue(env, 'ADMIN_CONVERSATIONS_PASSWORD_HASH');

  if (BCRYPT_HASH_PREFIX.test(passwordHash)) {
    return passwordHash;
  }

  throw new Error('ADMIN_CONVERSATIONS_PASSWORD_HASH must be a bcrypt hash');
};

const requirePositiveInteger = (env: AdminConversationReviewEnv): number => {
  const rawVersion = requireEnvValue(env, 'ADMIN_CONVERSATIONS_PASSWORD_VERSION');
  const version = Number(rawVersion);

  if (Number.isInteger(version) && version > 0) {
    return version;
  }

  throw new Error('ADMIN_CONVERSATIONS_PASSWORD_VERSION must be a positive integer');
};

const parseSecureCookie = (env: AdminConversationReviewEnv): boolean => {
  if (env.ADMIN_CONVO_COOKIE_SECURE !== 'false') {
    return true;
  }

  return false;
};

export const parseAdminConversationReviewConfig = (
  env: AdminConversationReviewEnv = process.env,
): AdminConversationReviewConfig => ({
  hashSalt: requireMinimumBytes(requireEnvValue(env, 'ADMIN_HASH_SALT'), 'ADMIN_HASH_SALT'),
  passwordHash: requireBcryptHash(env),
  passwordVersion: requirePositiveInteger(env),
  sessionSecret: requireMinimumBytes(
    requireEnvValue(env, 'ADMIN_CONVO_SESSION_SECRET'),
    'ADMIN_CONVO_SESSION_SECRET',
  ),
  secureCookie: parseSecureCookie(env),
});
