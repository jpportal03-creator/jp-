import { prisma } from '../../lib/prisma';

export function normalizeMatchUsers(a: string, b: string) {
  const sorted = [a, b].sort();
  return { userAId: sorted[0], userBId: sorted[1] };
}

export function createLikeKey(a: string, b: string) {
  const sorted = [a, b].sort();
  return `${sorted[0]}:${sorted[1]}`;
}

export async function recordLike(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error('Self-like is not allowed');
  }

  const target = await prisma.user.findUnique({
    where: { id: toUserId },
    include: { profile: true },
  });

  if (!target || target.status !== 'active' || !target.emailVerifiedAt || !target.profile || target.profile.discoverability === 'hidden') {
    throw new Error('Target user is unavailable');
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerUserId: fromUserId, blockedUserId: toUserId },
        { blockerUserId: toUserId, blockedUserId: fromUserId },
      ],
    },
  });

  if (blocked) {
    throw new Error('Interaction is unavailable');
  }

  const existing = await prisma.likeRecord.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId, toUserId },
    },
  });

  if (existing) {
    return { created: false, matched: false };
  }

  try {
    await prisma.likeRecord.create({ data: { fromUserId, toUserId } });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return { created: false, matched: false };
    }
    throw error;
  }

  const reciprocal = await prisma.likeRecord.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId },
    },
  });

  if (!reciprocal) {
    return { created: true, matched: false };
  }

  const pair = normalizeMatchUsers(fromUserId, toUserId);

  const match = await prisma.match.upsert({
    where: {
      userAId_userBId: pair,
    },
    update: {
      lastActivityAt: new Date(),
    },
    create: {
      ...pair,
      status: 'active',
      lastActivityAt: new Date(),
    },
  });

  const preference = await prisma.notificationPreference.findUnique({ where: { userId: toUserId } });
  if (preference?.newMatchEnabled !== false) {
    await prisma.notification.create({ data: { userId: toUserId, type: 'new_match', title: 'New match', body: 'You have a new match.', payload: { matchId: match.id } } });
  }

  return { created: true, matched: true, matchId: match.id };
}

export async function recordPass(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error('Self-pass is not allowed');
  }

  const target = await prisma.user.findUnique({
    where: { id: toUserId },
    include: { profile: true },
  });

  if (!target || target.status !== 'active' || !target.emailVerifiedAt || !target.profile || target.profile.discoverability === 'hidden') {
    throw new Error('Target user is unavailable');
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerUserId: fromUserId, blockedUserId: toUserId },
        { blockerUserId: toUserId, blockedUserId: fromUserId },
      ],
    },
  });

  if (blocked) {
    throw new Error('Interaction is unavailable');
  }

  return prisma.passRecord.upsert({
    where: {
      fromUserId_toUserId: { fromUserId, toUserId },
    },
    update: {},
    create: {
      fromUserId,
      toUserId,
    },
  });
}
