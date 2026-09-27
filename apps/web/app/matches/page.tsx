'use client';
import { apiUrl } from '@/lib/config';
import AppNavigation from '../components/AppNavigation';

import { useEffect, useState } from 'react';

type Match = { id: string; createdAt: string; lastActivityAt: string | null; unreadCount: number; latestMessage: { body: string; createdAt: string } | null; profile: { displayName: string; age: number | null; academicYear: number | null; gender: string | null; profilePhotoUrl: string | null; college: { name: string } | null; course: { name: string } | null; semester: { name: string } | null } };

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadMatches() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/v1/matches`, { credentials: 'include' });
      const body = await response.json() as { data?: Match[] };
      if (!response.ok || !body.data) throw new Error('Could not load your matches.');
      setMatches(body.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your matches.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadMatches(); }, []);

  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Your connections</span><h1>Matches</h1></div><a className="icon-button" href="/notifications" aria-label="Open notifications">♡</a></header><section className="matches-list">
    {loading && <div className="state-panel"><p>Loading matches...</p></div>}
    {!loading && error && <div className="state-panel"><strong>Matches are unavailable.</strong><p>{error}</p><button className="primary-button" onClick={() => void loadMatches()}>Try again</button></div>}
    {!loading && !error && matches.length === 0 && <div className="state-panel"><strong>No matches yet. Keep discovering!</strong><a className="primary-button" href="/discover">Discover</a></div>}
    {!loading && !error && matches.map((match) => <article className="match-row" key={match.id}>
      {match.profile.profilePhotoUrl ? <img src={match.profile.profilePhotoUrl} alt="" /> : <span className="avatar-fallback">{match.profile.displayName.slice(0, 1)}</span>}
      <div className="match-details"><h2>{match.profile.displayName}{match.profile.age ? `, ${match.profile.age}` : ''}{match.unreadCount > 0 && <b className="unread-badge">{match.unreadCount}</b>}</h2>
        <p>{[match.profile.college?.name, match.profile.course?.name, match.profile.academicYear ? `Year ${match.profile.academicYear}` : match.profile.semester?.name].filter(Boolean).join(' · ')}</p>
        <small>Matched {new Date(match.createdAt).toLocaleString()}</small>
      </div><a className="primary-button" href={`/chat/${match.id}`}>Message</a>
    </article>)}
  </section><AppNavigation /></main>;
}