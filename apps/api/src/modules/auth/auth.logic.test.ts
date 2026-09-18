import { describe, expect, it } from 'vitest';

import { ensureDomainMatchesCollege } from './auth.service';
import { hashVerificationCode, isVerificationCodeSingleUse } from './email-verification.service';

describe('auth logic', () => {
  it('rejects invalid institutional email shape', async () => {
    await expect(ensureDomainMatchesCollege('invalid')).resolves.toBe(false);
  });

  it('hashes verification codes without exposing the raw value', () => {
    const rawCode = '123456';
    const hash = hashVerificationCode(rawCode);

    expect(hash).not.toBe(rawCode);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashVerificationCode(rawCode));
  });

  it('treats a used verification code as single-use only', () => {
    expect(isVerificationCodeSingleUse({ verifiedAt: null })).toBe(true);
    expect(isVerificationCodeSingleUse({ verifiedAt: new Date('2024-01-01') })).toBe(false);
  });
});
