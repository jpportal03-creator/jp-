import crypto from 'crypto';

import { env } from '../../config/env';

export type CheckoutOrder = { providerOrderId: string; checkoutUrl: string };
export type VerifiedPaymentEvent = {
  eventId: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
  providerOrderId: string;
  providerPaymentId: string;
  status: 'succeeded' | 'failed' | 'refunded';
};

export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: { orderId: string; amountInPaise: number; currency: string; description: string }): Promise<CheckoutOrder>;
  verifyWebhook(payload: string, signature: string | undefined): boolean;
  parseWebhook(payload: unknown): VerifiedPaymentEvent | null;
}

export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox';

  async createCheckout(input: { orderId: string; amountInPaise: number; currency: string; description: string }) {
    return {
      providerOrderId: `sandbox_order_${input.orderId}`,
      checkoutUrl: `${env.APP_URL}/premium?order=${encodeURIComponent(input.orderId)}`,
    };
  }

  verifyWebhook(payload: string, signature: string | undefined) {
    if (!signature) return false;
    const expected = crypto.createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(payload).digest('hex');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  parseWebhook(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;
    const event = payload as Record<string, unknown>;
    const type = event.type;
    const data = event.data;
    if ((type !== 'payment.succeeded' && type !== 'payment.failed' && type !== 'payment.refunded') || !data || typeof data !== 'object') return null;
    const values = data as Record<string, unknown>;
    if (typeof event.id !== 'string' || typeof values.orderId !== 'string' || typeof values.paymentId !== 'string') return null;
    const eventType = type as VerifiedPaymentEvent['type'];
    const status: VerifiedPaymentEvent['status'] = eventType === 'payment.succeeded' ? 'succeeded' : eventType === 'payment.refunded' ? 'refunded' : 'failed';
    return { eventId: event.id, type: eventType, providerOrderId: values.orderId, providerPaymentId: values.paymentId, status };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'sandbox') return new SandboxPaymentProvider();
  throw new Error('Configured payment provider is not implemented');
}