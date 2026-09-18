import { describe, expect, it } from 'vitest';

import { createEnv, resolveWebOrigins } from './env';

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://db.example/app',
  JWT_SECRET: 'jwt-secret-for-test',
  AUTH_SECRET: 'auth-secret-for-test',
  APP_URL: 'https://jp-dating.example',
  WEB_ORIGINS: 'https://jp-dating.example',
} satisfies NodeJS.ProcessEnv;

describe('environment configuration', () => {
  it('uses APP_URL as the default web origin', () => {
    expect(resolveWebOrigins(undefined, 'https://jp-dating.example')).toBe('https://jp-dating.example');
  });

  it('normalizes a comma-separated web origin list', () => {
    expect(resolveWebOrigins(' https://app.example,https://admin.example ', 'https://fallback.example')).toBe('https://app.example,https://admin.example');
  });

  it('rejects malformed origins', () => {
    expect(() => resolveWebOrigins('https://app.example/path', 'https://fallback.example')).toThrow('WEB_ORIGINS contains an invalid origin');
  });

  it('fails clearly in production when PAYMENT_WEBHOOK_SECRET is missing', () => {
    expect(() => createEnv(productionEnv)).toThrow('PAYMENT_WEBHOOK_SECRET must be configured in production');
  });

  it('succeeds in production when PAYMENT_WEBHOOK_SECRET is provided', () => {
    expect(createEnv({ ...productionEnv, PAYMENT_WEBHOOK_SECRET: 'webhook-secret-for-test' }).PAYMENT_WEBHOOK_SECRET).toBe('webhook-secret-for-test');
  });

  it('uses a local payment webhook secret outside production', () => {
    expect(createEnv({ NODE_ENV: 'test' }).PAYMENT_WEBHOOK_SECRET).toBe('development-payment-webhook-secret');
  });

  it('does not expose configured secret values in validation errors', () => {
    const secretValue = 'do-not-include-this-secret';
    expect(() => createEnv({ ...productionEnv, JWT_SECRET: secretValue })).toThrow('PAYMENT_WEBHOOK_SECRET must be configured in production');

    try {
      createEnv({ ...productionEnv, JWT_SECRET: secretValue });
    } catch (error) {
      expect((error as Error).message).not.toContain(secretValue);
    }
  });
});
