import { describe, expect, it } from 'vitest';

import { areDatingPreferencesCompatible } from './profile-compatibility';

describe('dating preference compatibility', () => {
  it('requires both users to accept the other user gender', () => {
    expect(areDatingPreferencesCompatible({ gender: 'woman', interestedIn: 'men' }, { gender: 'man', interestedIn: 'women' })).toBe(true);
    expect(areDatingPreferencesCompatible({ gender: 'woman', interestedIn: 'men' }, { gender: 'man', interestedIn: 'everyone' })).toBe(true);
    expect(areDatingPreferencesCompatible({ gender: 'woman', interestedIn: 'men' }, { gender: 'man', interestedIn: 'men' })).toBe(false);
  });

  it('does not match users with missing preferences', () => {
    expect(areDatingPreferencesCompatible({ gender: 'woman', interestedIn: null }, { gender: 'man', interestedIn: 'women' })).toBe(false);
  });
});