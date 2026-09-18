import { describe, expect, it } from 'vitest';

import { normalizeMatchUsers, createLikeKey } from './matching.service';

describe('matching logic', () => {
  it('sorts the user pair consistently for match creation', () => {
    expect(normalizeMatchUsers('user-b', 'user-a')).toEqual({ userAId: 'user-a', userBId: 'user-b' });
  });

  it('creates a deterministic like key for duplicate protection', () => {
    expect(createLikeKey('alice', 'bob')).toBe('alice:bob');
    expect(createLikeKey('bob', 'alice')).toBe('alice:bob');
  });
});
