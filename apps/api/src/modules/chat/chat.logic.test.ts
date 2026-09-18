import { describe, expect, it } from 'vitest';

import { editMessageSchema, sendMessageSchema } from './chat.validators';

describe('chat input validation', () => {
  it('requires a UUID client message id and trims plain-text bodies', () => {
    const result = sendMessageSchema.safeParse({ matchId: '00000000-0000-0000-0000-000000000001', clientMessageId: '00000000-0000-0000-0000-000000000002', body: '  hello  ' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.body).toBe('hello');
  });

  it('rejects empty, oversized, or non-idempotent message input', () => {
    expect(sendMessageSchema.safeParse({ clientMessageId: 'not-a-uuid', body: '' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ clientMessageId: '00000000-0000-0000-0000-000000000002', body: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('uses the same safe body constraints for edits', () => {
    expect(editMessageSchema.safeParse({ body: '<script>alert(1)</script>' }).success).toBe(true);
    expect(editMessageSchema.safeParse({ body: ' ' }).success).toBe(false);
  });
});