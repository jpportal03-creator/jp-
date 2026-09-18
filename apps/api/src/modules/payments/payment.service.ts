import { Prisma } from '@prisma/client';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { getPaymentProvider, VerifiedPaymentEvent } from './payment.provider';

export const DEFAULT_PLANS = [
  { code: 'monthly', name: 'Monthly', description: 'Premium access billed every month.', durationDays: 30, priceInPaise: 9900, interval: 'month' },
  { code: 'quarterly', name: '3 Months', description: 'Premium access for three months.', durationDays: 90, priceInPaise: 19900, interval: 'quarter' },
  { code: 'yearly', name: 'Yearly', description: 'Premium access for one year.', durationDays: 365, priceInPaise: 49900, interval: 'year' },
];

export async function ensureDefaultPlans() {
  await Promise.all(DEFAULT_PLANS.map((plan) => prisma.subscriptionPlan.upsert({ where: { code: plan.code }, update: {}, create: plan })));
  return prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceInPaise: 'asc' } });
}

export async function hasPremiumAccess(userId: string) {
  const subscription = await prisma.subscription.findFirst({ where: { userId, status: 'active', endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
  return Boolean(subscription);
}

export async function getCurrentSubscription(userId: string) {
  const subscription = await prisma.subscription.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, include: { plan: true } });
  if (subscription?.status === 'active' && subscription.endsAt && subscription.endsAt <= new Date()) {
    return prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'expired' }, include: { plan: true } });
  }
  return subscription;
}

export async function createSubscriptionOrder(userId: string, planCode: string) {
  const plan = await prisma.subscriptionPlan.findFirst({ where: { code: planCode, active: true } });
  if (!plan) throw new Error('Plan unavailable');
  const provider = getPaymentProvider();
  const subscription = await prisma.subscription.create({ data: { userId, planId: plan.id, provider: provider.name, status: 'pending' } });
  const payment = await prisma.payment.create({ data: { userId, subscriptionId: subscription.id, provider: provider.name, amountInPaise: plan.priceInPaise, currency: plan.currency, status: 'pending', metadata: { planCode: plan.code } as Prisma.InputJsonValue } });
  const order = await provider.createCheckout({ orderId: payment.id, amountInPaise: plan.priceInPaise, currency: plan.currency, description: `JP Dating ${plan.name} Premium` });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: order.providerOrderId } });
  return { orderId: payment.id, provider: provider.name, providerOrderId: order.providerOrderId, checkoutUrl: order.checkoutUrl, amountInPaise: plan.priceInPaise, currency: plan.currency };
}

export async function createBoostOrder(userId: string) {
  const provider = getPaymentProvider();
  const payment = await prisma.payment.create({ data: { userId, provider: provider.name, amountInPaise: env.BOOST_PRICE_IN_PAISE, currency: 'INR', status: 'pending', metadata: { kind: 'boost' } as Prisma.InputJsonValue } });
  await prisma.profileBoost.create({ data: { userId, paymentId: payment.id, status: 'pending' } });
  const order = await provider.createCheckout({ orderId: payment.id, amountInPaise: env.BOOST_PRICE_IN_PAISE, currency: 'INR', description: 'JP Dating Profile Boost' });
  await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: order.providerOrderId } });
  return { orderId: payment.id, provider: provider.name, providerOrderId: order.providerOrderId, checkoutUrl: order.checkoutUrl, amountInPaise: env.BOOST_PRICE_IN_PAISE, currency: 'INR' };
}

export async function processPaymentEvent(event: VerifiedPaymentEvent) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.findFirst({ where: { OR: [{ providerOrderId: event.providerOrderId }, { providerPaymentId: event.providerPaymentId }] } });
      if (!payment) throw new Error('Payment not found');
      await transaction.paymentEvent.create({ data: { paymentId: payment.id, providerEventId: event.eventId, eventType: event.type, providerStatus: event.status, payload: event as unknown as Prisma.InputJsonValue } });
      const updatedPayment = await transaction.payment.update({ where: { id: payment.id }, data: { providerPaymentId: event.providerPaymentId, status: event.status } });
      if (payment.subscriptionId && event.status === 'succeeded') {
        const subscription = await transaction.subscription.findUnique({ where: { id: payment.subscriptionId }, include: { plan: true } });
        if (subscription) await transaction.subscription.update({ where: { id: subscription.id }, data: { status: 'active', startedAt: new Date(), endsAt: new Date(Date.now() + subscription.plan.durationDays * 86400000) } });
      }
      if (payment.subscriptionId && event.status === 'refunded') await transaction.subscription.update({ where: { id: payment.subscriptionId }, data: { status: 'cancelled', cancelledAt: new Date() } });
      const boost = await transaction.profileBoost.findUnique({ where: { paymentId: payment.id } });
      if (boost && event.status === 'succeeded') {
        await transaction.profileBoost.update({ where: { id: boost.id }, data: { status: 'active', startedAt: new Date(), expiresAt: new Date(Date.now() + env.BOOST_DURATION_HOURS * 3600000) } });
        await transaction.profile.update({ where: { userId: boost.userId }, data: { boostPriority: 1 } });
      }
      if (boost && event.status === 'refunded') await transaction.profileBoost.update({ where: { id: boost.id }, data: { status: 'cancelled' } });
      return updatedPayment;
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return null;
    throw error;
  }
}

export async function cancelSubscription(userId: string) {
  const subscription = await getCurrentSubscription(userId);
  if (!subscription || subscription.status !== 'active') throw new Error('Active subscription not found');
  return prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true, cancelledAt: new Date() }, include: { plan: true } });
}

export async function expireEntitlements() {
  const now = new Date();
  await prisma.subscription.updateMany({ where: { status: 'active', endsAt: { lte: now } }, data: { status: 'expired' } });
  const expiredBoosts = await prisma.profileBoost.findMany({ where: { status: 'active', expiresAt: { lte: now } }, select: { id: true, userId: true } });
  await prisma.profileBoost.updateMany({ where: { id: { in: expiredBoosts.map((boost) => boost.id) } }, data: { status: 'completed' } });
  await Promise.all(expiredBoosts.map((boost) => prisma.profile.updateMany({ where: { userId: boost.userId }, data: { boostPriority: 0 } })));
}