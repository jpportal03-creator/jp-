import { describe, expect, it } from 'vitest';

import { resolveWebOrigins } from './env';

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
});
