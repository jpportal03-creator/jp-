'use client';

import { apiUrl } from '@/lib/config';
import AppNavigation from '../components/AppNavigation';
import { useEffect, useState } from 'react';

type Conversation = {
  id: string;
  createdAt: string;
  lastActivityAt: string | null;
  unreadCount: number;
  latestMessage: { body: string; createdAt: string } | null;
  profile: { displayName: string; profilePhotoUrl: string | null };
};

export default function ChatInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadConversations() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/v1/chat/matches`, { credentials: 'include' });
      const result = await response.json() as { data?: Conversation[] };
      if (!response.ok || !result.data) throw new Error('Could not load conversations.');
      setConversations(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadConversations(); }, []);

  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Keep the conversation going</span><h1>Chat</h1></div></header>
    <section className="matches-list">
      {loading && <div className="state-panel"><p>Loading conversations...</p></div>}
      {!loading && error && <div className="state-panel"><strong>Chat is unavailable.</strong><p>{error}</p><button className="primary-button" onClick={() => void loadConversations()}>Try again</button></div>}
      {!loading && !error && conversations.length === 0 && <div className="state-panel"><strong>No conversations yet.</strong><p>Mutual matches will appear here.</p><a className="primary-button" href="/discover">Discover</a></div>}
      {!loading && !error && conversations.map((conversation) => <a className="match-row" href={`/chat/${conversation.id}`} key={conversation.id}>
        {conversation.profile.profilePhotoUrl ? <img src={conversation.profile.profilePhotoUrl} alt="" /> : <span className="avatar-fallback">{conversation.profile.displayName.slice(0, 1)}</span>}
        <div className="match-details"><h2>{conversation.profile.displayName}{conversation.unreadCount > 0 && <b className="unread-badge">{conversation.unreadCount}</b>}</h2><p>{conversation.latestMessage?.body ?? 'Say hello'}</p><small>{conversation.lastActivityAt ? new Date(conversation.lastActivityAt).toLocaleString() : 'New match'}</small></div>
      </a>)}
    </section><AppNavigation />
  </main>;
}