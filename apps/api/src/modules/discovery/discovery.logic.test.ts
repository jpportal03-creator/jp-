import { describe, expect, it } from 'vitest';

import { isDiscoveryProfileEligible } from './discovery.service';

const eligible = {
  userId: 'profile-user',
  userStatus: 'active' as const,
  emailVerifiedAt: new Date(),
  discoverability: 'discoverable' as const,
  displayName: 'A student',
  collegeId: 'college',
  courseId: 'course',
  semesterId: 'semester',
};

describe('discovery eligibility', () => {
  it('allows only active, verified, complete, visible profiles', () => {
    expect(isDiscoveryProfileEligible(eligible, 'current-user', new Set())).toBe(true);
    expect(isDiscoveryProfileEligible({ ...eligible, userStatus: 'suspended' }, 'current-user', new Set())).toBe(false);
    expect(isDiscoveryProfileEligible({ ...eligible, emailVerifiedAt: null }, 'current-user', new Set())).toBe(false);
    expect(isDiscoveryProfileEligible({ ...eligible, discoverability: 'hidden' }, 'current-user', new Set())).toBe(false);
    expect(isDiscoveryProfileEligible({ ...eligible, courseId: null }, 'current-user', new Set())).toBe(false);
  });

  it('never allows the current or excluded user through the gate', () => {
    expect(isDiscoveryProfileEligible(eligible, 'profile-user', new Set())).toBe(false);
    expect(isDiscoveryProfileEligible(eligible, 'current-user', new Set(['profile-user']))).toBe(false);
  });
});