'use client';

import { apiUrl } from '@/lib/config';
import AppNavigation from '../../components/AppNavigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

type Message = { id: string; senderId: string; body: string; clientMessageId: string; createdAt: string; readAt: string | null; deletedAt: string | null; pending?: boolean; failed?: boolean };
type Conversation = { id: string; profile: { displayName: string } };
type ReportCategory = 'harassment' | 'spam' | 'scam' | 'fake_profile' | 'inappropriate_content' | 'impersonation' | 'threatening_behavior' | 'other';
const socketUrl = apiUrl.replace(/^http/, 'ws');

export default function ChatConversation() {
  const { matchId } = useParams<{ matchId: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [title, setTitle] = useState('Conversation');
  const [status, setStatus] = useState('Connecting...');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('other');
  const [reportReason, setReportReason] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async (nextCursor: string | null = null) => {
    const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}&limit=25` : '?limit=25';
    const response = await fetch(`${apiUrl}/api/v1/matches/${matchId}/messages${query}`, { credentials: 'include' });
    if (!response.ok) throw new Error(response.status === 404 || response.status === 403 ? 'This conversation is unavailable.' : 'Could not load messages.');
    const result = await response.json() as { data: { items: Message[]; nextCursor: string | null; hasMore: boolean } };
    setMessages((current) => nextCursor ? [...result.data.items, ...current] : result.data.items);
    setCursor(result.data.nextCursor);
    setHasMore(result.data.hasMore);
    const latest = result.data.items.at(-1);
    if (latest) void fetch(`${apiUrl}/api/v1/messages/${latest.id}/read`, { method: 'POST', credentials: 'include' });
  }, [matchId]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true); setError('');
      try {
        const [sessionResponse, conversationsResponse] = await Promise.all([
          fetch(`${apiUrl}/api/v1/auth/session`, { credentials: 'include' }),
          fetch(`${apiUrl}/api/v1/chat/matches`, { credentials: 'include' }),
        ]);
        if (sessionResponse.status === 401 || conversationsResponse.status === 401) { router.replace('/login'); return; }
        const session = await sessionResponse.json() as { data?: { user?: { id: string } } };
        const conversations = await conversationsResponse.json() as { data?: Conversation[] };
        if (!sessionResponse.ok || !session.data?.user || !conversationsResponse.ok || !conversations.data) throw new Error('Could not open this conversation.');
        if (!active) return;
        setCurrentUserId(session.data.user.id);
        setTitle(conversations.data.find((item) => item.id === matchId)?.profile.displayName ?? 'Conversation');
        await loadMessages();
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not open this conversation.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [loadMessages, matchId, router]);

  useEffect(() => {
    if (!currentUserId || error) return;
    const socket = new WebSocket(`${socketUrl}/api/v1/realtime/${matchId}`);
    socketRef.current = socket;
    socket.onopen = () => {
      setStatus('Online');
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
    socket.onclose = () => {
      setStatus('Reconnecting...');
      if (!pollTimer.current) pollTimer.current = setInterval(() => { void loadMessages().catch(() => setStatus('Offline')); }, 5000);
    };
    socket.onerror = () => setStatus('Offline');
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type: string; message?: Message; online?: boolean; userId?: string };
        const incoming = payload.message;
        if (payload.type === 'message' && incoming) setMessages((current) => current.some((item) => item.id === incoming.id || item.clientMessageId === incoming.clientMessageId) ? current.map((item) => item.clientMessageId === incoming.clientMessageId ? incoming : item) : [...current, incoming]);
        if (payload.type === 'error') {
          setStatus('Offline');
          setMessages((current) => current.map((item) => item.pending ? { ...item, pending: false, failed: true } : item));
        }
        if (payload.type === 'presence') setStatus(payload.online ? 'Online' : 'Active recently');
        if (payload.type === 'typing' && payload.userId !== currentUserId) setTyping(true);
        if (payload.type === 'stop_typing') setTyping(false);
      } catch { setError('A live update could not be displayed. Refresh to reload the conversation.'); }
    };
    return () => {
      socket.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [currentUserId, error, loadMessages, matchId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, typing]);

  function updateBody(value: string) {
    setBody(value);
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'typing' }));
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'stop_typing' }));
    }, 900);
  }

  async function deliver(message: Message) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/messages`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ matchId, body: message.body, clientMessageId: message.clientMessageId }) });
      if (!response.ok) throw new Error();
      const result = await response.json() as { data: Message };
      setMessages((current) => current.map((item) => item.clientMessageId === message.clientMessageId ? result.data : item));
    } catch {
      setMessages((current) => current.map((item) => item.clientMessageId === message.clientMessageId ? { ...item, pending: false, failed: true } : item));
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text || !currentUserId || busy) return;
    const clientMessageId = crypto.randomUUID();
    const optimistic: Message = { id: `temp-${clientMessageId}`, senderId: currentUserId, body: text, clientMessageId, createdAt: new Date().toISOString(), readAt: null, deletedAt: null, pending: true };
    setMessages((current) => [...current, optimistic]); setBody('');
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: 'message', body: text, clientMessageId }));
    else await deliver(optimistic);
  }

  async function blockMatch() {
    if (!window.confirm(`Block ${title}? They will no longer appear in Discovery or this conversation.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/blocks`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetUserId: (await getOtherUserId()) }) });
      if (!response.ok) throw new Error('Could not block this account.');
      router.push('/matches');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not block this account.'); }
    finally { setBusy(false); }
  }

  async function getOtherUserId() {
    const response = await fetch(`${apiUrl}/api/v1/matches`, { credentials: 'include' });
    const result = await response.json() as { data?: { id: string; profile: { userId: string } }[] };
    return result.data?.find((item) => item.id === matchId)?.profile.userId ?? '';
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const targetUserId = await getOtherUserId();
      if (!targetUserId) throw new Error('Could not identify this account.');
      const response = await fetch(`${apiUrl}/api/v1/reports`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetUserId, category: reportCategory, reason: reportReason.trim() || undefined }) });
      if (!response.ok) throw new Error('Could not submit your report.');
      setNotice('Report submitted. Thank you for helping keep the community safe.'); setReportOpen(false); setReportReason('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit your report.'); }
    finally { setBusy(false); }
  }

  return <main className="chat-shell"><header className="chat-header"><Link href="/chat" aria-label="Back to conversations">Back</Link><div className="chat-avatar">{title.slice(0, 1).toUpperCase()}</div><div className="chat-title"><h1>{title}</h1><p className={status === 'Online' ? 'online' : ''}>{status}</p></div><details className="chat-safety"><summary aria-label="Conversation safety options">Options</summary><div><button type="button" onClick={() => setReportOpen((open) => !open)}>Report</button><button type="button" onClick={() => void blockMatch()} disabled={busy}>Block</button></div></details></header>
    {reportOpen && <form className="chat-report-form" onSubmit={(event) => void submitReport(event)}><label>Reason<select value={reportCategory} onChange={(event) => setReportCategory(event.target.value as ReportCategory)}><option value="harassment">Harassment</option><option value="spam">Spam</option><option value="scam">Scam</option><option value="fake_profile">Fake profile</option><option value="inappropriate_content">Inappropriate content</option><option value="impersonation">Impersonation</option><option value="threatening_behavior">Threatening behavior</option><option value="other">Other</option></select></label><label>Description, optional<textarea maxLength={500} value={reportReason} onChange={(event) => setReportReason(event.target.value)} /></label><button className="secondary-button" disabled={busy}>Submit report</button></form>}
    {notice && <p className="settings-notice chat-notice" role="status">{notice}</p>}
    {error && <div className="chat-state"><strong>Conversation unavailable.</strong><p>{error}</p><button className="secondary-button" onClick={() => void loadMessages().then(() => setError('')).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not reload messages.'))}>Retry</button></div>}
    <section className="message-list" aria-live="polite">
      {loading && <div className="chat-state"><p>Loading messages...</p></div>}
      {!loading && !error && hasMore && <button className="load-older" onClick={() => cursor && void loadMessages(cursor).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load older messages.'))}>Load older messages</button>}
      {!loading && !error && messages.length === 0 && <div className="chat-state"><strong>Start the conversation.</strong><p>Say hello to {title}.</p></div>}
      {!loading && !error && messages.map((message) => <article key={message.id} className={`message-bubble ${message.senderId === currentUserId ? 'sent' : 'received'} ${message.failed ? 'failed' : ''}`}><p>{message.deletedAt ? 'Message deleted' : message.body}</p><small>{message.failed ? <button type="button" onClick={() => void deliver(message)}>Failed - retry</button> : message.pending ? 'Sending...' : new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></article>)}
      {typing && <p className="typing-indicator">Typing...</p>}<div ref={bottomRef} />
    </section>
    <form className="message-composer" onSubmit={(event) => void send(event)}><input value={body} onChange={(event) => updateBody(event.target.value)} placeholder="Write a message" maxLength={2000} aria-label="Message" disabled={!currentUserId || Boolean(error)} /><button className="send-button" type="submit" disabled={!body.trim() || !currentUserId || busy} aria-label="Send message">Send</button></form>
    <AppNavigation />
  </main>;
}
