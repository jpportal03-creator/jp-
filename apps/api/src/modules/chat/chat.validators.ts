import { z } from 'zod';

export const sendMessageSchema = z.object({
  matchId: z.string().uuid().optional(),
  body: z.string().trim().min(1).max(2000),
  clientMessageId: z.string().uuid(),
});

export const editMessageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const paginatedMessagesQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
