import { prisma } from '../../lib/prisma';

export async function getProfileByUserId(userId: string) {
  return prisma.profile.findUnique({
    where: { userId },
    include: {
      college: true,
      course: true,
      semester: true,
    },
  });
}

export async function createOrUpdateProfile(userId: string, data: {
  displayName: string;
  bio?: string | null;
  gender?: 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say';
  collegeId?: string | null;
  courseId?: string | null;
  semesterId?: string | null;
  interests?: string[];
  discoverability?: 'discoverable' | 'hidden' | 'incognito';
}) {
  const existing = await prisma.profile.findUnique({ where: { userId } });

  if (existing) {
    return prisma.profile.update({
      where: { id: existing.id },
      data: {
        displayName: data.displayName,
        bio: data.bio ?? existing.bio,
        gender: data.gender ?? existing.gender,
        collegeId: data.collegeId ?? existing.collegeId,
        courseId: data.courseId ?? existing.courseId,
        semesterId: data.semesterId ?? existing.semesterId,
        discoverability: data.discoverability ?? existing.discoverability,
        interests: data.interests ?? existing.interests,
      },
    });
  }

  return prisma.profile.create({
    data: {
      userId,
      displayName: data.displayName,
      bio: data.bio,
      gender: data.gender,
      collegeId: data.collegeId,
      courseId: data.courseId,
      semesterId: data.semesterId,
      discoverability: data.discoverability ?? 'discoverable',
      interests: data.interests ?? [],
    },
  });
}
