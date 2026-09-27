import { afterEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../lib/prisma';
import { createLikeKey, normalizeMatchUsers, recordLike } from './matching.service';

afterEach(() => vi.restoreAllMocks());

describe('matching logic', () => {
  it('sorts the user pair consistently for match creation', () => {
    expect(normalizeMatchUsers('user-b', 'user-a')).toEqual({ userAId: 'user-a', userBId: 'user-b' });
  });

  it('creates a deterministic like key for duplicate protection', () => {
    expect(createLikeKey('alice', 'bob')).toBe('alice:bob');
    expect(createLikeKey('bob', 'alice')).toBe('alice:bob');
  });

  it('does not create a match for a one-sided like', async () => {
    const completeProfile = {
      userId: 'user-a', displayName: 'A student', collegeId: 'college', courseId: 'course',
      academicYear: 2, age: 21, gender: 'woman', interestedIn: 'men', lookingFor: 'dating', interests: ['Music'],
    };
    vi.spyOn(prisma.user, 'findUnique')
      .mockResolvedValueOnce({ status: 'active', profile: completeProfile } as never)
      .mockResolvedValueOnce({ status: 'active', profile: { ...completeProfile, userId: 'user-b', gender: 'man', interestedIn: 'women' } } as never);
    vi.spyOn(prisma.block, 'findFirst').mockResolvedValue(null as never);
    vi.spyOn(prisma.likeRecord, 'findUnique').mockResolvedValueOnce(null as never).mockResolvedValueOnce(null as never);
    vi.spyOn(prisma.likeRecord, 'create').mockResolvedValue({} as never);
    const createMatch = vi.spyOn(prisma.match, 'upsert');

    await expect(recordLike('user-a', 'user-b')).resolves.toEqual({ created: true, matched: false });
    expect(createMatch).not.toHaveBeenCalled();
  });
});
