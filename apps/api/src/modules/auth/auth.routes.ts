import type { FastifyInstance } from 'fastify';

import { successResponse, errorResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { ensureDomainMatchesCollege, createUserWithEmail, hashPassword, verifyPassword, getSessionUserIdFromRequest, setSessionCookie, clearSessionCookie } from './auth.service';
import { changePasswordSchema, deleteAccountSchema, registerSchema, loginSchema } from './auth.validators';

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
      },
    });
  });

  app.post('/api/v1/auth/register', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (request, reply) => {
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

    return successResponse({
      userId: user.id,
      status: user.status,
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
      },
    });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await clearSessionCookie(request, reply);
    return successResponse({ loggedOut: true });
  });

  app.put('/api/v1/auth/password', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }

    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Enter a valid current and new password'); }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, status: true } });
    if (!user || user.status !== 'active' || !user.passwordHash) { reply.code(403); return errorResponse('FORBIDDEN', 'Account is unavailable'); }
    if (!await verifyPassword(parsed.data.currentPassword, user.passwordHash)) { reply.code(400); return errorResponse('INVALID_CURRENT_PASSWORD', 'Current password is incorrect'); }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await clearSessionCookie(request, reply);
    return successResponse({ passwordChanged: true, requiresLogin: true });
  });

  app.delete('/api/v1/auth/account', { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }

    const parsed = deleteAccountSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Confirm account deletion and enter your password'); }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, status: true } });
    if (!user || user.status !== 'active' || !user.passwordHash) { reply.code(403); return errorResponse('FORBIDDEN', 'Account is unavailable'); }
    if (!await verifyPassword(parsed.data.password, user.passwordHash)) { reply.code(400); return errorResponse('INVALID_CREDENTIALS', 'Password is incorrect'); }

    const deletedAt = new Date();
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { status: 'deleted', deletedAt } }),
      prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: deletedAt } }),
    ]);
    await clearSessionCookie(request, reply);
    return successResponse({ accountDeleted: true });
  });

}
