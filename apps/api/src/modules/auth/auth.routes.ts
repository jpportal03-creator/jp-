import type { FastifyInstance } from 'fastify';

import { successResponse, errorResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { ensureDomainMatchesCollege, createUserWithEmail, verifyPassword, getSessionUserIdFromRequest, setSessionCookie, clearSessionCookie } from './auth.service';
import { registerSchema, loginSchema, verifyEmailSchema } from './auth.validators';
import { createEmailVerification, verifyEmailCode } from './email-verification.service';

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/v1/auth/session', async (request) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return errorResponse('UNAUTHORIZED', 'Unauthorized');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === 'suspended' || user.status === 'deleted') {
      return errorResponse('ACCOUNT_DISABLED', 'Account is unavailable');
    }

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
    });
  });

  app.post('/api/v1/auth/register', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid registration input');
    }

    const { email, password } = parsed.data;

    const allowed = await ensureDomainMatchesCollege(email);
    if (!allowed) {
      reply.code(400);
      return errorResponse('INVALID_INSTITUTION_EMAIL', 'Institutional email not recognized');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      reply.code(409);
      return errorResponse('USER_EXISTS', 'Account already exists');
    }

    const user = await createUserWithEmail(email, password);
    await createEmailVerification(email);

    return successResponse({
      userId: user.id,
      status: user.status,
      emailVerified: false,
      requiresEmailVerification: true,
    });
  });

  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid login input');
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash) {
      reply.code(401);
      return errorResponse('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      reply.code(401);
      return errorResponse('INVALID_CREDENTIALS', 'Invalid credentials');
    }

    if (user.status === 'suspended' || user.status === 'deleted') {
      reply.code(403);
      return errorResponse('ACCOUNT_DISABLED', 'Account is unavailable');
    }

    await setSessionCookie(reply, user.id);

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
      },
    });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await clearSessionCookie(request, reply);
    return successResponse({ loggedOut: true });
  });

  app.post('/api/v1/auth/verify-email', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const parsed = verifyEmailSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(400);
      return errorResponse('INVALID_REQUEST', 'Invalid verification data');
    }

    const { email, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      reply.code(404);
      return errorResponse('USER_NOT_FOUND', 'User not found');
    }

    const valid = await verifyEmailCode(email, code);
    if (!valid) {
      reply.code(400);
      return errorResponse('INVALID_VERIFICATION_CODE', 'Invalid or expired verification code');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        status: 'active',
      },
    });

    return successResponse({
      verified: true,
      userId: user.id,
    });
  });
}
