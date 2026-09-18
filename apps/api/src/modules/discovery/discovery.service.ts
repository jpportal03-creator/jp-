import { prisma } from '../../lib/prisma';

export type DiscoveryCursor = string | null;

export type DiscoveryEligibility = {
  userId: string;
  userStatus: 'active' | 'pending_verification' | 'suspended' | 'deleted';
  emailVerifiedAt: Date | null;
  discoverability: 'discoverable' | 'hidden' | 'incognito';
  displayName: string;
  collegeId: string | null;
  courseId: string | null;
  semesterId: string | null;
};

export function isDiscoveryProfileEligible(profile: DiscoveryEligibility, currentUserId: string, excludedUserIds: Set<string>) {
  return profile.userId !== currentUserId
    && !excludedUserIds.has(profile.userId)
    && profile.userStatus === 'active'
    && profile.emailVerifiedAt !== null
    && profile.discoverability !== 'hidden'
    && profile.displayName.trim().length > 0
    && profile.collegeId !== null
    && profile.courseId !== null
    && profile.semesterId !== null;
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
    select: { collegeId: true, courseId: true, semesterId: true, gender: true },
  });

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
        emailVerifiedAt: { not: null },
      },
      discoverability: { not: 'hidden' },
      displayName: { not: '' },
      collegeId: { not: null },
      courseId: { not: null },
      semesterId: { not: null },
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
    items: page.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio,
      gender: profile.gender,
      discoverability: profile.discoverability,
      college: profile.college,
      course: profile.course,
      semester: profile.semester,
      profilePhotoUrl: profile.profilePhotoUrl,
      interests: profile.interests,
    })),
    nextCursor,
    hasMore,
  };
}
