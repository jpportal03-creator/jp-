import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { errorResponse, successResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { getSessionUserIdFromRequest } from '../auth/auth.service';

const preferenceSchema = z.object({ newMatchEnabled: z.boolean().optional(), newMessageEnabled: z.boolean().optional(), accountEnabled: z.boolean().optional() });
const subscriptionSchema = z.object({ endpoint: z.string().url(), subscription: z.record(z.unknown()) });

async function userIdFrom(request: { cookies?: Record<string, string | undefined> }) { return getSessionUserIdFromRequest(request); }

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/api/v1/notifications', async (request, reply) => {
    const userId = await userIdFrom(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const items = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, type: true, title: true, body: true, payload: true, readAt: true, createdAt: true } });
    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
    return successResponse({ items, unreadCount });
  });

  app.post('/api/v1/notifications/:notificationId/read', async (request, reply) => {
    const userId = await userIdFrom(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const notificationId = (request.params as { notificationId: string }).notificationId;
    await prisma.notification.updateMany({ where: { id: notificationId, userId }, data: { readAt: new Date() } });
    return successResponse({ read: true });
  });

  app.post('/api/v1/notifications/read-all', async (request, reply) => {
    const userId = await userIdFrom(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return successResponse({ read: true });
  });

  app.get('/api/v1/notification-preferences', async (request, reply) => {
    const userId = await userIdFrom(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const preferences = await prisma.notificationPreference.upsert({ where: { userId }, update: {}, create: { userId } });
    return successResponse(preferences);
  });

  app.patch('/api/v1/notification-preferences', async (request, reply) => {
    const userId = await userIdFrom(request);
    const parsed = preferenceSchema.safeParse(request.body);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid notification preferences'); }
    const preferences = await prisma.notificationPreference.upsert({ where: { userId }, update: parsed.data, create: { userId, ...parsed.data } });
    return successResponse(preferences);
  });

  app.post('/api/v1/push-subscriptions', async (request, reply) => {
    const userId = await userIdFrom(request);
    const parsed = subscriptionSchema.safeParse(request.body);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid push subscription'); }
    const subscription = await prisma.pushSubscription.upsert({ where: { endpoint: parsed.data.endpoint }, update: { userId, subscription: parsed.data.subscription as Prisma.InputJsonValue }, create: { userId, endpoint: parsed.data.endpoint, subscription: parsed.data.subscription as Prisma.InputJsonValue } });
    return successResponse({ id: subscription.id });
  });
}