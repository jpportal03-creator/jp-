type PublicProfileInput = {
  id?: string;
  userId: string;
  displayName: string;
  age: number | null;
  academicYear: number | null;
  gender: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  interests: string[];
  privacySettings: unknown;
  college?: { id?: string; name: string } | null;
  course?: { id?: string; name: string } | null;
  semester?: { id?: string; name: string } | null;
};

export function toPublicProfile(profile: PublicProfileInput) {
  const privacy = profile.privacySettings && typeof profile.privacySettings === 'object' && !Array.isArray(profile.privacySettings)
    ? profile.privacySettings as Record<string, unknown>
    : {};

  return {
    ...(profile.id ? { id: profile.id } : {}),
    userId: profile.userId,
    displayName: profile.displayName,
    age: profile.age,
    academicYear: profile.academicYear,
    gender: privacy.showGender === false ? null : profile.gender,
    bio: profile.bio,
    profilePhotoUrl: profile.profilePhotoUrl,
    interests: profile.interests,
    college: privacy.showCollege === false ? null : profile.college ?? null,
    course: profile.course ?? null,
    semester: profile.semester ?? null,
  };
}