import { prisma } from '../../lib/prisma';

export async function getVisibleMatchUserIds(userId: string, otherUserIds: string[]) {
  if (otherUserIds.length === 0) return new Set<string>();

  const [users, blocks] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: otherUserIds }, status: 'active' }, select: { id: true } }),
    prisma.block.findMany({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: { in: otherUserIds } },
          { blockedUserId: userId, blockerUserId: { in: otherUserIds } },
        ],
      },
      select: { blockerUserId: true, blockedUserId: true },
    }),
  ]);

  const blockedUserIds = new Set(blocks.map((block) => block.blockerUserId === userId ? block.blockedUserId : block.blockerUserId));
  return new Set(users.map((user) => user.id).filter((id) => !blockedUserIds.has(id)));
}