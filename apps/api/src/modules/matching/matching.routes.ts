import type { FastifyInstance } from 'fastify';

import { successResponse, errorResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { recordLike, recordPass } from './matching.service';
import { getSessionUserIdFromRequest } from '../auth/auth.service';
import { z } from 'zod';

const interactionSchema = z.object({ targetUserId: z.string().uuid() });

export async function matchingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return reply.code(401).send(errorResponse('UNAUTHORIZED', 'Unauthorized'));
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser || dbUser.status !== 'active' || !dbUser.emailVerifiedAt) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Forbidden'));
    }
  });

  app.get('/api/v1/matches', async (request) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const rows = await prisma.match.findMany({
      where: {
        status: 'active',
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    const otherUserIds = rows.map((row) => row.userAId === userId ? row.userBId : row.userAId);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: otherUserIds } },
      select: {
        userId: true,
        displayName: true,
        profilePhotoUrl: true,
        course: { select: { name: true } },
        semester: { select: { name: true } },
      },
    });
    const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

    return successResponse(rows.flatMap((row) => {
      const otherUserId = row.userAId === userId ? row.userBId : row.userAId;
      const profile = profileByUserId.get(otherUserId);
      return profile ? [{
        id: row.id,
        createdAt: row.createdAt,
        profile,
      }] : [];
    }));
  });

  app.post('/api/v1/likes', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = interactionSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Target user ID is required');
    }

    const result = await recordLike(userId, parsed.data.targetUserId);
    return successResponse({ liked: true, matched: result.matched, ...(result.matchId ? { matchId: result.matchId } : {}) });
  });

  app.post('/api/v1/passes', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = interactionSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Target user ID is required');
    }

    await recordPass(userId, parsed.data.targetUserId);
    return successResponse({ passed: true });
  });
}
