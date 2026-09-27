import { describe, expect, it } from 'vitest';

import { createProfileSchema } from './profile.validators';

const validProfile = {
  displayName: 'A student',
  age: 18,
  academicYear: 1,
  interestedIn: 'men',
  lookingFor: 'dating',
  gender: 'woman',
  collegeId: '11111111-1111-4111-8111-111111111111',
  courseId: '22222222-2222-4222-8222-222222222222',
  interests: ['Music'],
};

describe('profile setup validation', () => {
  it('rejects ages below 18 and accepts age 18', () => {
    expect(createProfileSchema.safeParse({ ...validProfile, age: 17 }).success).toBe(false);
    expect(createProfileSchema.safeParse({ ...validProfile, age: 18 }).success).toBe(true);
  });

  it('rejects non-integer ages and invalid academic years', () => {
    expect(createProfileSchema.safeParse({ ...validProfile, age: 18.5 }).success).toBe(false);
    expect(createProfileSchema.safeParse({ ...validProfile, academicYear: 5 }).success).toBe(false);
    expect(createProfileSchema.safeParse({ ...validProfile, academicYear: 2.5 }).success).toBe(false);
  });

  it('accepts only the declared dating preference enums', () => {
    expect(createProfileSchema.safeParse({ ...validProfile, interestedIn: 'everyone' }).success).toBe(true);
    expect(createProfileSchema.safeParse({ ...validProfile, lookingFor: 'casual_dating' }).success).toBe(true);
    expect(createProfileSchema.safeParse({ ...validProfile, interestedIn: 'anyone' }).success).toBe(false);
  });
});