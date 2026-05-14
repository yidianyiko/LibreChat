import crypto from 'crypto';

const MIN_SALT_BYTES = 32;
const ANON_ID_HEX_LENGTH = 12;

const assertValidHashSalt = (hashSalt: string): void => {
  if (Buffer.byteLength(hashSalt, 'utf8') >= MIN_SALT_BYTES) {
    return;
  }

  throw new Error('ADMIN_HASH_SALT must be at least 32 bytes');
};

export const anonymizeUserId = (userId: string, hashSalt: string): string => {
  assertValidHashSalt(hashSalt);

  return crypto
    .createHmac('sha256', hashSalt)
    .update(userId)
    .digest('hex')
    .slice(0, ANON_ID_HEX_LENGTH);
};
