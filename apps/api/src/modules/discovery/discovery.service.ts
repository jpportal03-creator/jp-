import { prisma } from '../../lib/prisma';
import { isProfileComplete } from '../profiles/profile-completeness';
import { toPublicProfile } from '../profiles/public-profile';

export type DiscoveryCursor = string | null;

export type DiscoveryEligibility = {
  userId: string;
  userStatus: 'active' | 'pending_verification' | 'suspended' | 'deleted';
  discoverability: 'discoverable' | 'hidden' | 'incognito';
  displayName: string;
  collegeId: string | null;
  courseId: string | null;
  academicYear: number | null;
  age: number | null;
  gender: string | null;
  interestedIn: string | null;
  lookingFor: string | null;
  interests: string[];
};

export function getMutualPreferenceFilter(profile: { gender: string; interestedIn: 'men' | 'women' | 'everyone' }) {
  const acceptedGenders = profile.interestedIn === 'men'
    ? ['man']
    : profile.interestedIn === 'women'
      ? ['woman']
      : undefined;
  const acceptedPreferences = profile.gender === 'man'
    ? ['men', 'everyone']
    : profile.gender === 'woman'
      ? ['women', 'everyone']
      : ['everyone'];

  return {
    ...(acceptedGenders ? { gender: { in: acceptedGenders } } : {}),
    interestedIn: { in: acceptedPreferences },
  };
}

export function isDiscoveryProfileEligible(profile: DiscoveryEligibility, currentUserId: string, excludedUserIds: Set<string>) {
  return profile.userId !== currentUserId
    && !excludedUserIds.has(profile.userId)
    && profile.userStatus === 'active'
    && profile.discoverability !== 'hidden'
    && isProfileComplete(profile);
}

export async function getDiscoveryProfiles(userId: string, cursor: DiscoveryCursor, limit: number) {
  const pageSize = Math.min(Math.max(limit, 1), 25);

  const liked = await prisma.likeRecord.findMany({
    where: { fromUserId: userId },
    select: { toUserId: true },
  });

  const passed = await prisma.passRecord.findMany({
    where: { fromUserId: userId },
    select: { toUserId: true },
  });

  const matched = await prisma.match.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });

  const blocked = await prisma.block.findMany({
    where: { OR: [{ blockerUserId: userId }, { blockedUserId: userId }] },
    select: { blockerUserId: true, blockedUserId: true },
  });

  const excludedUserIds = new Set<string>([userId]);

  for (const row of liked) {
    excludedUserIds.add(row.toUserId);
  }

  for (const row of passed) {
    excludedUserIds.add(row.toUserId);
  }

  for (const row of matched) {
    excludedUserIds.add(row.userAId);
    excludedUserIds.add(row.userBId);
  }

  for (const row of blocked) {
    excludedUserIds.add(row.blockerUserId);
    excludedUserIds.add(row.blockedUserId);
  }

  const currentProfile = await prisma.profile.findUnique({
    where: { userId },
    select: { collegeId: true, courseId: true, semesterId: true, gender: true, interestedIn: true },
  });

  const preferenceFilter = currentProfile?.interestedIn && currentProfile.gender
    ? getMutualPreferenceFilter({ gender: currentProfile.gender, interestedIn: currentProfile.interestedIn })
    : {};

  const query: {
    where: Record<string, unknown>;
    include: Record<string, unknown>;
    orderBy: Record<string, string> | Array<Record<string, string>>;
    take: number;
    cursor?: { id: string };
    skip?: number;
  } = {
    where: {
      userId: { notIn: [...excludedUserIds] },
      user: {
        status: 'active',
      },
      discoverability: { not: 'hidden' },
      displayName: { not: '' },
      collegeId: { not: null },
      courseId: { not: null },
      academicYear: { in: [1, 2, 3, 4] },
      age: { gte: 18 },
      gender: { not: null },
      lookingFor: { not: null },
      interests: { isEmpty: false },
      ...preferenceFilter,
      ...(currentProfile?.collegeId ? { collegeId: currentProfile.collegeId } : {}),
      ...(currentProfile?.courseId ? { courseId: currentProfile.courseId } : {}),
      ...(currentProfile?.semesterId ? { semesterId: currentProfile.semesterId } : {}),
    },
    include: {
      user: { select: { id: true } },
      college: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      semester: { select: { id: true, name: true } },
    },
    orderBy: [{ boostPriority: 'desc' }, { createdAt: 'desc' }],
    take: pageSize + 1,
  };

  if (cursor) {
    query.cursor = { id: cursor };
    query.skip = 1;
  }

  const profiles = await prisma.profile.findMany(query);
  const hasMore = profiles.length > pageSize;
  const nextCursor = hasMore ? profiles[pageSize - 1]?.id ?? null : null;
  const page = profiles.slice(0, pageSize);

  return {
    items: page.map((profile) => toPublicProfile(profile)),
    nextCursor,
    hasMore,
  };
}
