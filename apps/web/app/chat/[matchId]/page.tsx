'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

type Message = { id: string; senderId: string; body: string; clientMessageId: string; createdAt: string; readAt: string | null; deletedAt: string | null; pending?: boolean; failed?: boolean };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const socketUrl = apiUrl.replace(/^http/, 'ws');

export default function ChatPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadMessages(nextCursor: string | null = null) {
    const query = nextCursor ? `?cursor=${nextCursor}&limit=25` : '?limit=25';
    const response = await fetch(`${apiUrl}/api/v1/matches/${matchId}/messages${query}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Match unavailable');
    const result = await response.json() as { data: { items: Message[]; nextCursor: string | null; hasMore: boolean } };
    setMessages((current) => nextCursor ? [...result.data.items, ...current] : result.data.items);
    setCursor(result.data.nextCursor);
    setHasMore(result.data.hasMore);
    const last = result.data.items.at(-1);
    if (last) void fetch(`${apiUrl}/api/v1/messages/${last.id}/read`, { method: 'POST', credentials: 'include' });
  }

  useEffect(() => {
    void loadMessages().catch(() => setStatus('Match unavailable'));
    const socket = new WebSocket(`${socketUrl}/api/v1/realtime/${matchId}`);
    socketRef.current = socket;
    socket.onopen = () => setStatus('Online');
    socket.onclose = () => setStatus('Reconnecting...');
    socket.onerror = () => setStatus('Offline');
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as { type: string; message?: Message; online?: boolean; userId?: string };
      const incoming = message.message;
      if (message.type === 'message' && incoming) setMessages((current) => current.some((item) => item.id === incoming.id || item.clientMessageId === incoming.clientMessageId) ? current.map((item) => item.clientMessageId === incoming.clientMessageId ? incoming : item) : [...current, incoming]);
      if (message.type === 'presence') setStatus(message.online ? 'Online' : 'Active recently');
      if (message.type === 'typing' && message.userId) setTyping(true);
      if (message.type === 'stop_typing') setTyping(false);
    };
    return () => { socket.close(); if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, [matchId]);

  function updateBody(value: string) {
    setBody(value);
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'typing' }));
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socketRef.current?.send(JSON.stringify({ type: 'stop_typing' })), 900);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if (!text) return;
    const clientMessageId = crypto.randomUUID();
    const optimistic: Message = { id: `temp-${clientMessageId}`, senderId: 'me', body: text, clientMessageId, createdAt: new Date().toISOString(), readAt: null, deletedAt: null, pending: true };
    setMessages((current) => [...current, optimistic]); setBody('');
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'message', body: text, clientMessageId }));
    else await deliver(optimistic);
  }

  async function deliver(message: Message) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/messages`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchId, body: message.body, clientMessageId: message.clientMessageId }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { data: Message };
      setMessages((current) => current.map((item) => item.clientMessageId === message.clientMessageId ? result.data : item));
    } catch { setMessages((current) => current.map((item) => item.clientMessageId === message.clientMessageId ? { ...item, pending: false, failed: true } : item)); }
  }

  return <main className="chat-shell"><header className="chat-header"><a href="/matches" aria-label="Back to matches">‹</a><div className="chat-avatar">•</div><div><h1>Conversation</h1><p className={status === 'Online' ? 'online' : ''}>{status}</p></div><button className="icon-button" aria-label="Chat options">•••</button></header><section className="message-list" aria-live="polite">{hasMore && <button className="load-older" onClick={() => cursor && void loadMessages(cursor)}>Load older messages</button>}{messages.map((message) => <article key={message.id} className={`message-bubble ${message.senderId === 'me' ? 'sent' : 'received'} ${message.failed ? 'failed' : ''}`}><p>{message.deletedAt ? 'Message deleted' : message.body}</p><small>{message.failed ? 'Failed · tap to retry' : message.pending ? 'Sending...' : new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>)}{typing && <p className="typing-indicator">Typing...</p>}<div ref={bottomRef} /></section><form className="message-composer" onSubmit={(event) => void send(event)}><button type="button" className="composer-icon" aria-label="Emoji picker">☺</button><input value={body} onChange={(event) => updateBody((event.target as unknown as { value: string }).value)} placeholder="Write a message" maxLength={2000} aria-label="Message" /><button className="send-button" type="submit" disabled={!body.trim()} aria-label="Send message">↑</button></form></main>;
}