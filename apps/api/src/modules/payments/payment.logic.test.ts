import crypto from 'crypto';
import { describe, expect, it } from 'vitest';

import { env } from '../../config/env';
import { DEFAULT_PLANS } from './payment.service';
import { SandboxPaymentProvider } from './payment.provider';

describe('payment safety', () => {
  it('keeps the initial prices on the server-side plan configuration', () => {
    expect(DEFAULT_PLANS.map((plan) => [plan.code, plan.priceInPaise])).toEqual([
      ['monthly', 9900],
      ['quarterly', 19900],
      ['yearly', 49900],
    ]);
  });

  it('accepts only a valid webhook signature', () => {
    const provider = new SandboxPaymentProvider();
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded', data: { orderId: 'order_1', paymentId: 'pay_1' } });
    const signature = crypto.createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(payload).digest('hex');
    expect(provider.verifyWebhook(payload, signature)).toBe(true);
    expect(provider.verifyWebhook(payload, 'invalid')).toBe(false);
  });

  it('rejects malformed or unsupported webhook events', () => {
    const provider = new SandboxPaymentProvider();
    expect(provider.parseWebhook({ type: 'subscription.active' })).toBeNull();
    expect(provider.parseWebhook({ id: 'evt_1', type: 'payment.succeeded', data: {} })).toBeNull();
  });
});