import type { FastifyInstance } from 'fastify';

import { getSessionUserIdFromRequest } from '../auth/auth.service';
import { createMessageForMatch, getActiveMatchForUser } from './chat.service';

type SocketLike = { send: (payload: string) => void; close: () => void; on: (event: string, handler: (value?: unknown) => void) => void };
type RequestLike = { cookies?: Record<string, string | undefined> };
const rooms = new Map<string, Set<SocketLike>>();

function broadcast(matchId: string, event: object) {
  const payload = JSON.stringify(event);
  for (const socket of rooms.get(matchId) ?? []) socket.send(payload);
}

export async function realtimeRoutes(app: FastifyInstance) {
  app.get('/api/v1/realtime/:matchId', { websocket: true, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (socket, request) => {
    const userId = await getSessionUserIdFromRequest(request as RequestLike);
    const matchId = (request.params as { matchId: string }).matchId;
    if (!userId) { socket.close(); return; }
    try { await getActiveMatchForUser(matchId, userId); } catch { socket.close(); return; }
    const members = rooms.get(matchId) ?? new Set<SocketLike>();
    members.add(socket as SocketLike);
    rooms.set(matchId, members);
    broadcast(matchId, { type: 'presence', online: true });
    socket.on('message', async (raw: unknown) => {
      try {
        const event = JSON.parse(String(raw)) as { type?: string; body?: string; clientMessageId?: string };
        if (event.type === 'typing') { broadcast(matchId, { type: 'typing', userId }); return; }
        if (event.type === 'stop_typing') { broadcast(matchId, { type: 'stop_typing', userId }); return; }
        if (event.type === 'message' && event.body && event.clientMessageId) {
          const message = await createMessageForMatch(matchId, userId, event.body.trim(), event.clientMessageId);
          broadcast(matchId, { type: 'message', message });
        }
      } catch { socket.send(JSON.stringify({ type: 'error', message: 'Unable to process that event.' })); }
    });
    socket.on('close', () => { members.delete(socket as SocketLike); if (members.size === 0) rooms.delete(matchId); broadcast(matchId, { type: 'presence', online: false }); });
  });
}