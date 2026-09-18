import { prisma } from '../../lib/prisma';

export async function getActiveMatchForUser(matchId: string, userId: string) {
  const match = await prisma.match.findFirst({ where: { id: matchId, status: 'active', OR: [{ userAId: userId }, { userBId: userId }] } });
  if (!match) throw new Error('Match unavailable');
  const blocked = await prisma.block.findFirst({ where: { OR: [{ blockerUserId: match.userAId, blockedUserId: match.userBId }, { blockerUserId: match.userBId, blockedUserId: match.userAId }] } });
  if (blocked) throw new Error('Match unavailable');
  const users = await prisma.user.findMany({ where: { id: { in: [match.userAId, match.userBId] } }, select: { status: true, emailVerifiedAt: true } });
  if (users.length !== 2 || users.some((user) => user.status !== 'active' || !user.emailVerifiedAt)) throw new Error('Match unavailable');
  return match;
}

const messageSelect = { id: true, matchId: true, senderId: true, body: true, clientMessageId: true, createdAt: true, updatedAt: true, editedAt: true, deletedAt: true, readAt: true } as const;

export async function getMatchedUsersForUser(userId: string) {
  const rows = await prisma.match.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }], status: 'active' }, orderBy: { lastActivityAt: 'desc' }, select: { id: true, userAId: true, userBId: true, lastActivityAt: true, createdAt: true, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: messageSelect } } });
  const otherUserIds = rows.map((row) => row.userAId === userId ? row.userBId : row.userAId);
  const profiles = await prisma.profile.findMany({ where: { userId: { in: otherUserIds } }, select: { userId: true, displayName: true, profilePhotoUrl: true } });
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  return Promise.all(rows.map(async (row) => {
    const otherUserId = row.userAId === userId ? row.userBId : row.userAId;
    const profile = profileByUserId.get(otherUserId);
    const unreadCount = await prisma.message.count({ where: { matchId: row.id, senderId: { not: userId }, readAt: null, deletedAt: null } });
    return profile ? { id: row.id, createdAt: row.createdAt, lastActivityAt: row.lastActivityAt, profile, latestMessage: row.messages[0] ?? null, unreadCount } : null;
  })).then((items) => items.filter((item): item is NonNullable<typeof item> => item !== null));
}

export async function getMessagesForMatch(matchId: string, userId: string, cursor?: string | null, limit = 20) {
  await getActiveMatchForUser(matchId, userId);
  const pageSize = Math.min(Math.max(limit, 1), 50);
  const rows = await prisma.message.findMany({ where: { matchId }, orderBy: { createdAt: 'desc' }, take: pageSize + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: messageSelect });
  const hasMore = rows.length > pageSize;
  return { items: rows.slice(0, pageSize).reverse(), nextCursor: hasMore ? rows[pageSize - 1]?.id ?? null : null, hasMore };
}

export async function createMessageForMatch(matchId: string, senderId: string, body: string, clientMessageId: string) {
  await getActiveMatchForUser(matchId, senderId);
  const existing = await prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId, clientMessageId } }, select: messageSelect });
  if (existing) return existing;
  let message;
  try {
    message = await prisma.$transaction(async (transaction) => {
      const created = await transaction.message.create({ data: { matchId, senderId, body, clientMessageId }, select: messageSelect });
      await transaction.match.update({ where: { id: matchId }, data: { lastActivityAt: new Date() } });
      return created;
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const duplicate = await prisma.message.findUnique({ where: { senderId_clientMessageId: { senderId, clientMessageId } }, select: messageSelect });
    if (!duplicate) throw error;
    return duplicate;
  }
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (match) {
    const recipientId = match.userAId === senderId ? match.userBId : match.userAId;
    const preference = await prisma.notificationPreference.findUnique({ where: { userId: recipientId } });
    if (preference?.newMessageEnabled !== false) await prisma.notification.create({ data: { userId: recipientId, type: 'new_message', title: 'New message', body: 'You have a new message.', payload: { matchId } } });
  }
  return message;
}

export async function markMatchMessagesRead(matchId: string, userId: string) {
  await getActiveMatchForUser(matchId, userId);
  return prisma.message.updateMany({ where: { matchId, senderId: { not: userId }, readAt: null }, data: { readAt: new Date() } });
}

export async function editMessage(messageId: string, userId: string, body: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderId !== userId || message.deletedAt) throw new Error('Message unavailable');
  await getActiveMatchForUser(message.matchId, userId);
  return prisma.message.update({ where: { id: messageId }, data: { body, editedAt: new Date() }, select: messageSelect });
}

export async function deleteMessage(messageId: string, userId: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderId !== userId) throw new Error('Message unavailable');
  await getActiveMatchForUser(message.matchId, userId);
  return prisma.message.update({ where: { id: messageId }, data: { body: '', deletedAt: new Date() }, select: messageSelect });
}
