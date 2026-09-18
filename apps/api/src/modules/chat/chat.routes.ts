import type { FastifyInstance } from 'fastify';

import { successResponse, errorResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { sendMessageSchema, paginatedMessagesQuerySchema, editMessageSchema } from './chat.validators';
import { createMessageForMatch, deleteMessage, editMessage, getMatchedUsersForUser, getMessagesForMatch, markMatchMessagesRead } from './chat.service';
import { getSessionUserIdFromRequest } from '../auth/auth.service';

export async function chatRoutes(app: FastifyInstance) {
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

  app.get('/api/v1/chat/matches', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const data = await getMatchedUsersForUser(userId);
    return successResponse(data);
  });

  app.get('/api/v1/matches/:matchId/messages', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const matchId = (request.params as { matchId: string }).matchId;
    const parsed = paginatedMessagesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid message query');
    }

    const data = await getMessagesForMatch(matchId, userId, parsed.data.cursor, parsed.data.limit);
    return successResponse(data);
  });

  app.post('/api/v1/messages', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success || !parsed.data.matchId) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid message payload');
    }

    const data = await createMessageForMatch(parsed.data.matchId, userId, parsed.data.body, parsed.data.clientMessageId);
    return successResponse(data);
  });

  app.patch('/api/v1/messages/:messageId', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const parsed = editMessageSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid message body'); }
    const messageId = (request.params as { messageId: string }).messageId;
    return successResponse(await editMessage(messageId, userId, parsed.data.body));
  });

  app.delete('/api/v1/messages/:messageId', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const messageId = (request.params as { messageId: string }).messageId;
    return successResponse(await deleteMessage(messageId, userId));
  });

  app.post('/api/v1/messages/:messageId/read', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const messageId = (request.params as { messageId: string }).messageId;
    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { matchId: true } });
    if (!message) { reply.code(404); return errorResponse('MESSAGE_NOT_FOUND', 'Message not found'); }
    await markMatchMessagesRead(message.matchId, userId);
    return successResponse({ read: true });
  });

  app.get('/api/v1/chat/:matchId/messages', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const matchId = (request.params as { matchId: string }).matchId;
    const parsed = paginatedMessagesQuerySchema.safeParse(request.query);
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid message query'); }
    return successResponse(await getMessagesForMatch(matchId, userId, parsed.data.cursor, parsed.data.limit));
  });

  app.post('/api/v1/chat/:matchId/messages', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const matchId = (request.params as { matchId: string }).matchId;
    const parsed = sendMessageSchema.safeParse({ ...(request.body as object), matchId });
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid message payload'); }
    return successResponse(await createMessageForMatch(matchId, userId, parsed.data.body, parsed.data.clientMessageId));
  });
}
