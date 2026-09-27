import { describe, expect, it } from 'vitest';

import { isProfileComplete } from './profile-completeness';

const completeProfile = {
  displayName: 'A student',
  collegeId: 'college-id',
  courseId: 'course-id',
  academicYear: 2,
  age: 21,
  gender: 'woman',
  interestedIn: 'men',
  lookingFor: 'dating',
  interests: ['Music'],
};

describe('profile completeness', () => {
  it('allows a complete profile into Discovery', () => {
    expect(isProfileComplete(completeProfile)).toBe(true);
  });

  it('blocks an incomplete profile from Discovery', () => {
    expect(isProfileComplete({ ...completeProfile, interestedIn: null })).toBe(false);
    expect(isProfileComplete({ ...completeProfile, interests: [] })).toBe(false);
    expect(isProfileComplete(null)).toBe(false);
  });

  it('does not treat out-of-range age or academic year as complete', () => {
    expect(isProfileComplete({ ...completeProfile, age: 17 })).toBe(false);
    expect(isProfileComplete({ ...completeProfile, academicYear: 5 })).toBe(false);
  });
});