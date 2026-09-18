import type { FastifyInstance } from 'fastify';

import { successResponse, errorResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { getDiscoveryProfiles } from './discovery.service';
import { getSessionUserIdFromRequest } from '../auth/auth.service';

const makeQueryNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 25));
};

export async function discoveryRoutes(app: FastifyInstance) {
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

  app.get('/api/v1/discovery', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const query = request.query as { cursor?: string; limit?: string };
    const cursor = query.cursor ?? null;
    const limit = makeQueryNumber(query.limit, 12);

    const data = await getDiscoveryProfiles(userId, cursor, limit);
    return successResponse(data);
  });
}
