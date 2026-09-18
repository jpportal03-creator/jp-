'use client';

import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Match = { id: string; createdAt: string; lastActivityAt: string | null; unreadCount: number; latestMessage: { body: string; createdAt: string } | null; profile: { displayName: string; profilePhotoUrl: string | null } };

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/chat/matches`, { credentials: 'include' })
      .then((response) => response.json() as Promise<{ data: Match[] }>)
      .then((body) => setMatches(body.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Your connections</span><h1>Matches</h1></div><a className="icon-button" href="/notifications" aria-label="Open notifications">♡</a></header><section className="matches-list">{loading && <div className="state-panel"><p>Loading matches...</p></div>}{!loading && matches.length === 0 && <div className="state-panel"><strong>No matches yet.</strong><p>Your mutual likes will appear here.</p><a className="primary-button" href="/discover">Keep discovering</a></div>}{matches.map((match) => <a className="match-row" href={`/chat/${match.id}`} key={match.id}>{match.profile.profilePhotoUrl ? <img src={match.profile.profilePhotoUrl} alt="" /> : <span className="avatar-fallback">{match.profile.displayName.slice(0, 1)}</span>}<div className="match-details"><h2>{match.profile.displayName}{match.unreadCount > 0 && <b className="unread-badge">{match.unreadCount}</b>}</h2><p>{match.latestMessage?.body || 'Start a conversation'}</p><small>{match.lastActivityAt ? new Date(match.lastActivityAt).toLocaleDateString() : 'New match'}</small></div></a>)}</section><nav className="bottom-nav" aria-label="Main navigation"><a href="/discover">Discover</a><a className="active" href="/matches">Matches</a><a href="/messages">Messages</a><a href="/profile">Profile</a></nav></main>;
}