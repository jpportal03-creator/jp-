import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { errorResponse, successResponse } from '../../lib/api-response';
import { prisma } from '../../lib/prisma';
import { getSessionUserIdFromRequest } from '../auth/auth.service';
import { cancelSubscription, createBoostOrder, createSubscriptionOrder, ensureDefaultPlans, expireEntitlements, getCurrentSubscription, hasPremiumAccess, processPaymentEvent } from './payment.service';
import { getPaymentProvider } from './payment.provider';

const planSchema = z.object({ planCode: z.string().trim().min(1).max(40) });
const planUpdateSchema = z.object({ active: z.boolean().optional(), priceInPaise: z.number().int().positive().optional(), description: z.string().trim().max(300).optional() });

async function authenticatedUser(request: { cookies?: Record<string, string | undefined> }) {
  const userId = await getSessionUserIdFromRequest(request);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true, emailVerifiedAt: true, role: true } });
  return user?.status === 'active' && user.emailVerifiedAt ? user : null;
}

export async function paymentRoutes(app: FastifyInstance) {
  app.get('/api/v1/subscription/plans', async () => successResponse(await ensureDefaultPlans()));

  app.get('/api/v1/subscription/me', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    await expireEntitlements();
    const subscription = await getCurrentSubscription(user.id);
    return successResponse({ subscription, premium: await hasPremiumAccess(user.id) });
  });

  app.post('/api/v1/subscription/create', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await authenticatedUser(request);
    const parsed = planSchema.safeParse(request.body);
    if (!user) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid plan'); }
    try { return successResponse(await createSubscriptionOrder(user.id, parsed.data.planCode)); } catch (error) { if ((error as Error).message === 'Plan unavailable') { reply.code(404); return errorResponse('PLAN_UNAVAILABLE', 'Plan unavailable'); } throw error; }
  });

  app.post('/api/v1/subscription/cancel', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    try { return successResponse(await cancelSubscription(user.id)); } catch { reply.code(404); return errorResponse('SUBSCRIPTION_NOT_FOUND', 'Active subscription not found'); }
  });

  app.get('/api/v1/payments/history', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    const payments = await prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, amountInPaise: true, currency: true, status: true, provider: true, providerPaymentId: true, createdAt: true, subscription: { select: { plan: { select: { name: true } } } }, boost: { select: { status: true } } } });
    return successResponse(payments);
  });

  app.post('/api/v1/boosts/create', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    return successResponse(await createBoostOrder(user.id));
  });

  app.get('/api/v1/boosts/me', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user) { reply.code(401); return errorResponse('UNAUTHORIZED', 'Unauthorized'); }
    await expireEntitlements();
    return successResponse(await prisma.profileBoost.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, status: true, startedAt: true, expiresAt: true, createdAt: true, payment: { select: { amountInPaise: true, currency: true, status: true } } } }));
  });

  app.post('/api/v1/payments/webhook', async (request, reply) => {
    const payload = JSON.stringify(request.body ?? {});
    const provider = getPaymentProvider();
    const signature = request.headers['x-payment-signature'];
    if (!provider.verifyWebhook(payload, typeof signature === 'string' ? signature : undefined)) { reply.code(401); return errorResponse('INVALID_SIGNATURE', 'Invalid payment signature'); }
    const event = provider.parseWebhook(request.body);
    if (!event) { reply.code(400); return errorResponse('INVALID_WEBHOOK', 'Invalid payment event'); }
    await processPaymentEvent(event);
    return successResponse({ received: true });
  });

  app.get('/api/v1/admin/payments/overview', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user || user.role !== 'admin') { reply.code(403); return errorResponse('FORBIDDEN', 'Admin access required'); }
    const [successful, activePremium, boosts, failed] = await Promise.all([
      prisma.payment.aggregate({ where: { status: 'succeeded' }, _count: { _all: true }, _sum: { amountInPaise: true } }),
      prisma.subscription.count({ where: { status: 'active', endsAt: { gt: new Date() } } }),
      prisma.profileBoost.count({ where: { status: { in: ['active', 'completed'] } } }),
      prisma.payment.count({ where: { status: 'failed' } }),
    ]);
    return successResponse({ successfulPayments: successful._count._all, grossAmountInPaise: successful._sum.amountInPaise ?? 0, activePremiumUsers: activePremium, boostsPurchased: boosts, failedPayments: failed });
  });

  app.get('/api/v1/admin/payment-plans', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user || user.role !== 'admin') { reply.code(403); return errorResponse('FORBIDDEN', 'Admin access required'); }
    return successResponse(await prisma.subscriptionPlan.findMany({ orderBy: { priceInPaise: 'asc' } }));
  });

  app.patch('/api/v1/admin/payment-plans/:planCode', async (request, reply) => {
    const user = await authenticatedUser(request);
    const parsed = planUpdateSchema.safeParse(request.body);
    if (!user || user.role !== 'admin') { reply.code(403); return errorResponse('FORBIDDEN', 'Admin access required'); }
    if (!parsed.success) { reply.code(400); return errorResponse('INVALID_REQUEST', 'Invalid plan update'); }
    const planCode = (request.params as { planCode: string }).planCode;
    const plan = await prisma.subscriptionPlan.update({ where: { code: planCode }, data: parsed.data });
    return successResponse(plan);
  });

  app.get('/api/v1/admin/subscriptions', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user || user.role !== 'admin') { reply.code(403); return errorResponse('FORBIDDEN', 'Admin access required'); }
    return successResponse(await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, userId: true, status: true, provider: true, startedAt: true, endsAt: true, cancelledAt: true, cancelAtPeriodEnd: true, plan: { select: { code: true, name: true, priceInPaise: true, currency: true } } } }));
  });

  app.get('/api/v1/admin/payments', async (request, reply) => {
    const user = await authenticatedUser(request);
    if (!user || user.role !== 'admin') { reply.code(403); return errorResponse('FORBIDDEN', 'Admin access required'); }
    return successResponse(await prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, userId: true, amountInPaise: true, currency: true, provider: true, providerPaymentId: true, providerOrderId: true, status: true, createdAt: true } }));
  });
}