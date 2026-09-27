import { describe, expect, it } from 'vitest';

import { ensureDomainMatchesCollege } from './auth.service';
import { changePasswordSchema, deleteAccountSchema } from './auth.validators';

describe('auth logic', () => {
  it('rejects invalid institutional email shape', async () => {
    await expect(ensureDomainMatchesCollege('invalid')).resolves.toBe(false);
  });

  it('requires the current password and an explicit delete confirmation', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'new-password' }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: 'same-password', newPassword: 'same-password' }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ password: 'current-password', confirmation: 'DELETE' }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ password: 'current-password', confirmation: 'delete' }).success).toBe(false);
  });
});
