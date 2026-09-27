import { prisma } from '../../lib/prisma';
import { isProfileComplete } from '../profiles/profile-completeness';
import { areDatingPreferencesCompatible } from '../profiles/profile-compatibility';

export function normalizeMatchUsers(a: string, b: string) {
  const sorted = [a, b].sort();
  return { userAId: sorted[0], userBId: sorted[1] };
}

export function createLikeKey(a: string, b: string) {
  const sorted = [a, b].sort();
  return `${sorted[0]}:${sorted[1]}`;
}

async function assertInteractionAllowed(fromUserId: string, targetUserId: string) {
  const [fromUser, targetUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, include: { profile: true } }),
    prisma.user.findUnique({ where: { id: targetUserId }, include: { profile: true } }),
  ]);

  if (!fromUser || fromUser.status !== 'active' || !isProfileComplete(fromUser.profile)
    || !targetUser || targetUser.status !== 'active' || !isProfileComplete(targetUser.profile)
    || targetUser.profile?.discoverability === 'hidden'
    || !areDatingPreferencesCompatible(fromUser.profile!, targetUser.profile!)) {
    throw new Error('Target user is unavailable');
  }

  const blocked = await prisma.block.findFirst({
    where: { OR: [{ blockerUserId: fromUserId, blockedUserId: targetUserId }, { blockerUserId: targetUserId, blockedUserId: fromUserId }] },
  });
  if (blocked) throw new Error('Interaction is unavailable');
}

export async function recordLike(fromUserId: string, toUserId: string) {
  if (fromUserId === toUserId) {
    throw new Error('Self-like is not allowed');
  }

  await assertInteractionAllowed(fromUserId, toUserId);

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

  await assertInteractionAllowed(fromUserId, toUserId);

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
