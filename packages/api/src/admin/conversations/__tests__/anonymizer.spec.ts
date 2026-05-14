import { anonymizeUserId } from '../anonymizer';

describe('anonymizeUserId', () => {
  const salt = '12345678901234567890123456789012';

  it('returns a stable 12-character hex anonymized id', () => {
    const first = anonymizeUserId('user-123', salt);
    const second = anonymizeUserId('user-123', salt);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{12}$/);
  });

  it('changes output when salt rotates', () => {
    const rotatedSalt = 'abcdefghijklmnopqrstuvwxyz123456';

    expect(anonymizeUserId('user-123', salt)).not.toBe(anonymizeUserId('user-123', rotatedSalt));
  });

  it('rejects a short salt', () => {
    expect(() => anonymizeUserId('user-123', 'short')).toThrow(
      'ADMIN_HASH_SALT must be at least 32 bytes',
    );
  });
});
