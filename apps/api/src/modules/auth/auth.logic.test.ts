import { describe, expect, it } from 'vitest';

import { ensureDomainMatchesCollege } from './auth.service';

describe('auth logic', () => {
  it('rejects invalid institutional email shape', async () => {
    await expect(ensureDomainMatchesCollege('invalid')).resolves.toBe(false);
  });
});
