export type ProfileCompletenessData = {
  displayName: string;
  collegeId: string | null;
  courseId: string | null;
  academicYear: number | null;
  age: number | null;
  gender: string | null;
  interestedIn: string | null;
  lookingFor: string | null;
  interests: string[];
} | null;

export function isProfileComplete(profile: ProfileCompletenessData): boolean {
  return Boolean(profile
    && profile.displayName.trim().length > 0
    && profile.collegeId
    && profile.courseId
    && profile.academicYear !== null
    && profile.academicYear >= 1
    && profile.academicYear <= 4
    && profile.age !== null
    && Number.isInteger(profile.age)
    && profile.age >= 18
    && profile.gender
    && profile.interestedIn
    && profile.lookingFor
    && profile.interests.length > 0);
}