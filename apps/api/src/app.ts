import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';

import { env } from './config/env';
import { logger } from './lib/logger';
import { successResponse, errorResponse } from './lib/api-response';
import { authRoutes } from './modules/auth/auth.routes';
import { profileRoutes } from './modules/profiles/profile.routes';
import { discoveryRoutes } from './modules/discovery/discovery.routes';
import { matchingRoutes } from './modules/matching/matching.routes';
import { chatRoutes } from './modules/chat/chat.routes';
import { safetyRoutes } from './modules/safety/safety.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { realtimeRoutes } from './modules/chat/chat.realtime';
import { paymentRoutes } from './modules/payments/payment.routes';

export async function createApp() {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cookie);
  await app.register(websocket);

  await app.register(cors, {
    origin: env.WEB_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip ?? 'unknown',
  });

  await app.register(authRoutes);
  await app.register(profileRoutes);
  await app.register(discoveryRoutes);
  await app.register(matchingRoutes);
  await app.register(chatRoutes);
  await app.register(safetyRoutes);
  await app.register(notificationRoutes);
  await app.register(realtimeRoutes);
  await app.register(paymentRoutes);

  app.get('/health', async () => {
    return successResponse({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.setNotFoundHandler(async (_req, reply) => {
    reply.code(404).send(errorResponse('NOT_FOUND', 'Resource not found'));
  });

  app.setErrorHandler(async (error, request, reply) => {
    const validationError = error as { validation?: unknown };

    if (validationError.validation) {
      await reply.code(400).send(errorResponse('INVALID_REQUEST', 'Invalid request body'));
      return;
    }

    if ((error as Error).message === 'Unauthorized') {
      await reply.code(401).send(errorResponse('UNAUTHORIZED', 'Unauthorized'));
      return;
    }

    if ((error as Error).message === 'Forbidden') {
      await reply.code(403).send(errorResponse('FORBIDDEN', 'Forbidden'));
      return;
    }

    if ((error as Error).message === 'Self-like is not allowed' || (error as Error).message === 'Self-pass is not allowed') {
      await reply.code(400).send(errorResponse('INVALID_INTERACTION', 'You cannot interact with yourself'));
      return;
    }

    if ((error as Error).message === 'Target user is unavailable') {
      await reply.code(404).send(errorResponse('TARGET_UNAVAILABLE', 'This profile is no longer available'));
      return;
    }

    if ((error as Error).message === 'Interaction is unavailable') {
      await reply.code(403).send(errorResponse('INTERACTION_BLOCKED', 'This interaction is unavailable'));
      return;
    }

    if ((error as Error).message === 'Match unavailable' || (error as Error).message === 'Message unavailable') {
      await reply.code(404).send(errorResponse('RESOURCE_UNAVAILABLE', 'This resource is no longer available'));
      return;
    }

    logger.error({ err: error, requestId: request.id }, 'Unhandled server error');
    await reply.code(500).send(errorResponse('INTERNAL_SERVER_ERROR', 'Something went wrong'));
  });

  return app;
}

export async function startServer() {
  const app = await createApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info(`API listening on http://localhost:${env.PORT}`);
  return app;
}
