import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';

import { successResponse, errorResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { createProfileSchema, updatePrivacySchema } from './profile.validators';
import { createOrUpdateProfile, getProfileByUserId } from './profile.service';
import { getSessionUserIdFromRequest } from '../auth/auth.service';

export async function profileRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return reply.code(401).send(errorResponse('UNAUTHORIZED', 'Unauthorized'));
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser || dbUser.status === 'suspended' || dbUser.status === 'deleted' || !dbUser.emailVerifiedAt) {
      return reply.code(403).send(errorResponse('FORBIDDEN', 'Forbidden'));
    }
  });

  app.get('/api/v1/profile/me', async (request) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const profile = await getProfileByUserId(userId);
    return successResponse(profile);
  });

  app.post('/api/v1/profile', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = createProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid profile payload');
    }

    const profile = await createOrUpdateProfile(userId, parsed.data);

    return successResponse(profile);
  });

  app.patch('/api/v1/profile/privacy', async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      reply.code(401);
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const parsed = updatePrivacySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid privacy settings');
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      reply.code(404);
      return errorResponse('PROFILE_NOT_FOUND', 'Profile not found');
    }

    const updatedPrivacySettings = {
      ...(profile.privacySettings as Record<string, unknown> | null),
      ...(parsed.data as Record<string, unknown>),
    };

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        discoverability: parsed.data.discoverability ?? profile.discoverability,
        privacySettings: updatedPrivacySettings as Prisma.InputJsonValue,
      },
    });

    return successResponse(updated);
  });
}
