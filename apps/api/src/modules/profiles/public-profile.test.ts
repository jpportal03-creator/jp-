import { describe, expect, it } from 'vitest';

import { toPublicProfile } from './public-profile';

const profile = {
  id: 'profile-id',
  userId: 'user-id',
  displayName: 'A student',
  age: 21,
  academicYear: 2,
  gender: 'woman',
  bio: 'Hello',
  profilePhotoUrl: null,
  interests: ['Music'],
  privacySettings: null,
  college: { id: 'college-id', name: 'College' },
  course: { id: 'course-id', name: 'Course' },
  semester: { id: 'semester-id', name: 'Semester 2' },
  interestedIn: 'men',
  lookingFor: 'dating',
};

describe('public profile serialization', () => {
  it('returns allowed profile details but never dating preferences', () => {
    const result = toPublicProfile(profile);
    expect(result).toMatchObject({ age: 21, academicYear: 2, gender: 'woman', college: { name: 'College' } });
    expect(result).not.toHaveProperty('interestedIn');
    expect(result).not.toHaveProperty('lookingFor');
  });

  it('honors existing gender and college privacy settings', () => {
    const result = toPublicProfile({ ...profile, privacySettings: { showGender: false, showCollege: false } });
    expect(result.gender).toBeNull();
    expect(result.college).toBeNull();
  });
});