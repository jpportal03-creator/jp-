import { prisma } from '../../lib/prisma';
import type { ProfileSetupInput } from './profile.validators';

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

export async function getProfileSetupOptions() {
  const colleges = await prisma.college.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      courses: {
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return { colleges, academicYears: [1, 2, 3, 4] };
}

export async function createOrUpdateProfile(userId: string, data: ProfileSetupInput) {
  const [college, course] = await Promise.all([
    prisma.college.findFirst({ where: { id: data.collegeId, active: true }, select: { id: true } }),
    prisma.course.findFirst({ where: { id: data.courseId, collegeId: data.collegeId, active: true }, select: { id: true } }),
  ]);

  if (!college || !course) throw new Error('Invalid profile college or course');

  const existing = await prisma.profile.findUnique({ where: { userId } });

  if (existing) {
    return prisma.profile.update({
      where: { id: existing.id },
      data: {
        displayName: data.displayName,
        bio: data.bio ?? existing.bio,
        age: data.age,
        academicYear: data.academicYear,
        gender: data.gender,
        interestedIn: data.interestedIn,
        lookingFor: data.lookingFor,
        collegeId: data.collegeId,
        courseId: data.courseId,
        semesterId: data.semesterId ?? existing.semesterId,
        discoverability: data.discoverability ?? existing.discoverability,
        interests: data.interests,
        profilePhotoUrl: data.profilePhotoUrl || null,
      },
    });
  }

  return prisma.profile.create({
    data: {
      userId,
      displayName: data.displayName,
      bio: data.bio,
      age: data.age,
      academicYear: data.academicYear,
      gender: data.gender,
      interestedIn: data.interestedIn,
      lookingFor: data.lookingFor,
      collegeId: data.collegeId,
      courseId: data.courseId,
      semesterId: data.semesterId,
      discoverability: data.discoverability ?? 'discoverable',
      interests: data.interests,
      profilePhotoUrl: data.profilePhotoUrl || null,
    },
  });
}
