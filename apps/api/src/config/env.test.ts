import { describe, expect, it } from 'vitest';

import { createEnv, getEnvConfigDiagnostic, resolveWebOrigins } from './env';

const productionEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://db.example/app',
  JWT_SECRET: 'jwt-secret-for-test',
  AUTH_SECRET: 'auth-secret-for-test',
  APP_URL: 'https://jp-dating.example',
  WEB_ORIGINS: 'https://jp-dating.example',
  PAYMENT_WEBHOOK_SECRET: 'webhook-secret-for-test',
} satisfies NodeJS.ProcessEnv;

const requiredProductionVariables = [
  'DATABASE_URL',
  'JWT_SECRET',
  'AUTH_SECRET',
  'APP_URL',
  'PAYMENT_WEBHOOK_SECRET',
] as const;

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

  it.each(requiredProductionVariables)('fails clearly in production when %s is missing', (name) => {
    const source: NodeJS.ProcessEnv = { ...productionEnv };
    delete source[name];

    expect(() => createEnv(source)).toThrow(`${name} must be configured in production`);
  });

  it('succeeds in production when PAYMENT_WEBHOOK_SECRET is provided', () => {
    expect(createEnv(productionEnv).PAYMENT_WEBHOOK_SECRET).toBe(productionEnv.PAYMENT_WEBHOOK_SECRET);
  });

  it('uses APP_URL as the production WEB_ORIGINS fallback', () => {
    const source: NodeJS.ProcessEnv = { ...productionEnv };
    delete source.WEB_ORIGINS;

    expect(createEnv(source).WEB_ORIGINS).toBe(productionEnv.APP_URL);
  });

  it('uses a local payment webhook secret outside production', () => {
    expect(createEnv({ NODE_ENV: 'test' }).PAYMENT_WEBHOOK_SECRET).toBe('development-payment-webhook-secret');
  });

  it('does not expose configured secret values in validation errors', () => {
    const secretValue = 'do-not-include-this-secret';
    const source: NodeJS.ProcessEnv = { ...productionEnv, JWT_SECRET: secretValue };
    delete source.PAYMENT_WEBHOOK_SECRET;

    expect(() => createEnv(source)).toThrow('PAYMENT_WEBHOOK_SECRET must be configured in production');

    try {
      createEnv(source);
    } catch (error) {
      expect((error as Error).message).not.toContain(secretValue);
    }
  });

  it('reports only configured booleans in the safe diagnostic', () => {
    expect(getEnvConfigDiagnostic({ ...productionEnv, WEB_ORIGINS: '' })).toEqual({
      DATABASE_URL: true,
      JWT_SECRET: true,
      AUTH_SECRET: true,
      APP_URL: true,
      WEB_ORIGINS: false,
      PAYMENT_WEBHOOK_SECRET: true,
    });
  });
});
