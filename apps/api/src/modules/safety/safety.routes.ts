import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { errorResponse, successResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { getSessionUserIdFromRequest } from '../auth/auth.service';

const targetSchema = z.object({ targetUserId: z.string().uuid() });
const reportSchema = targetSchema.extend({
  category: z.enum(['harassment', 'spam', 'scam', 'fake_profile', 'inappropriate_content', 'impersonation', 'threatening_behavior', 'other']),
  reason: z.string().trim().max(500).optional(),
});
const messageReportSchema = z.object({ messageId: z.string().uuid(), category: reportSchema.shape.category, reason: z.string().trim().max(500).optional() });

async function getAuthenticatedUserId(request: { cookies?: Record<string, string | undefined> }) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.status === 'active' && user.emailVerifiedAt ? userId : null;
}

export async function safetyRoutes(app: FastifyInstance) {
  app.post('/api/v1/blocks', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);
    const parsed = targetSchema.safeParse(request.body);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }
    if (!parsed.success || parsed.data.targetUserId === userId) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Valid target user ID is required');
    }

    await prisma.block.upsert({
      where: { blockerUserId_blockedUserId: { blockerUserId: userId, blockedUserId: parsed.data.targetUserId } },
      update: {},
      create: { blockerUserId: userId, blockedUserId: parsed.data.targetUserId },
    });

    await prisma.match.updateMany({
      where: {
        OR: [
          { userAId: userId, userBId: parsed.data.targetUserId },
          { userAId: parsed.data.targetUserId, userBId: userId },
        ],
      },
      data: { status: 'blocked' },
    });

    return successResponse({ blocked: true });
  });

  app.delete('/api/v1/blocks/:userId', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);
    const blockedUserId = (request.params as { userId: string }).userId;
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    await prisma.block.deleteMany({ where: { blockerUserId: userId, blockedUserId } });
    return successResponse({ unblocked: true });
  });

  app.post('/api/v1/matches/:matchId/unmatch', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);
    const matchId = (request.params as { matchId: string }).matchId;
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const updated = await prisma.match.updateMany({ where: { id: matchId, status: 'active', OR: [{ userAId: userId }, { userBId: userId }] }, data: { status: 'unmatched' } });
    if (updated.count === 0) { reply.code(404); return errorResponse('MATCH_NOT_FOUND', 'Match unavailable'); }
    return successResponse({ unmatched: true });
  });

  app.post('/api/v1/reports', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);
    const parsed = reportSchema.safeParse(request.body);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }
    if (!parsed.success || parsed.data.targetUserId === userId) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid report data');
    }

    const report = await prisma.report.create({
      data: {
        reporterUserId: userId,
        reportedUserId: parsed.data.targetUserId,
        category: parsed.data.category,
        reason: parsed.data.reason,
      },
      select: { id: true, status: true },
    });

    return successResponse(report);
  });

  app.post('/api/v1/message-reports', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getAuthenticatedUserId(request);
    const parsed = messageReportSchema.safeParse(request.body);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid message report'); }
    const message = await prisma.message.findUnique({ where: { id: parsed.data.messageId }, select: { matchId: true } });
    if (!message) { reply.code(404); return errorResponse('MESSAGE_NOT_FOUND', 'Message not found'); }
    const match = await prisma.match.findFirst({ where: { id: message.matchId, OR: [{ userAId: userId }, { userBId: userId }] } });
    if (!match) { reply.code(403); return errorResponse('FORBIDDEN', 'You cannot report this message'); }
    const report = await prisma.report.create({ data: { reporterUserId: userId, messageId: parsed.data.messageId, category: parsed.data.category, reason: parsed.data.reason }, select: { id: true, status: true } });
    return successResponse(report);
  });
}