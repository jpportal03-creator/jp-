'use client';

import { useEffect, useState } from 'react';

type Profile = {
  id: string;
  userId: string;
  displayName: string;
  bio: string | null;
  gender: string | null;
  profilePhotoUrl: string | null;
  interests: string[];
  college: { name: string } | null;
  course: { name: string } | null;
  semester: { name: string } | null;
};

type DiscoveryResponse = { items: Profile[]; nextCursor: string | null; hasMore: boolean };
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function DiscoverPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<Profile | null>(null);

  async function loadProfiles(nextCursor: string | null = null) {
    setLoading(true);
    setError(null);
    try {
      const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}&limit=10` : '?limit=10';
      const response = await fetch(`${apiUrl}/api/v1/discovery${query}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Unable to load discovery');
      const body = await response.json() as { data: DiscoveryResponse };
      setProfiles((current) => nextCursor ? [...current, ...body.data.items] : body.data.items);
      setCursor(body.data.nextCursor);
      setHasMore(body.data.hasMore);
    } catch {
      setError('We could not load discovery right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfiles(); }, []);

  async function choose(action: 'like' | 'pass') {
    const profile = profiles[0];
    if (!profile || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/${action === 'like' ? 'likes' : 'passes'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.userId }),
      });
      if (!response.ok) throw new Error('Interaction failed');
      const body = await response.json() as { data?: { matched?: boolean } };
      setProfiles((current) => current.slice(1));
      if (body.data?.matched) setMatch(profile);
      if (profiles.length < 3 && hasMore && cursor) void loadProfiles(cursor);
    } catch {
      setError(`Your ${action} did not go through. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const eventTarget = globalThis as unknown as { addEventListener: (name: string, listener: (event: { key: string }) => void) => void; removeEventListener: (name: string, listener: (event: { key: string }) => void) => void };
    function onKeyDown(event: { key: string }) {
      if (event.key === 'ArrowLeft') void choose('pass');
      if (event.key === 'ArrowRight') void choose('like');
    }
    eventTarget.addEventListener('keydown', onKeyDown);
    return () => eventTarget.removeEventListener('keydown', onKeyDown);
  });

  const profile = profiles[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">Independent student community</span><h1>Discover</h1></div>
        <button className="icon-button" aria-label="Open profile menu">•••</button>
      </header>
      <section className="discovery-stage" aria-live="polite">
        {loading && <div className="profile-card skeleton" aria-label="Loading profile" />}
        {!loading && error && <div className="state-panel"><strong>Something went wrong</strong><p>{error}</p><button className="primary-button" onClick={() => void loadProfiles()}>Try again</button></div>}
        {!loading && !error && profile && <article className="profile-card">
          <div className="photo-frame">
            {profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt={`${profile.displayName}'s profile`} /> : <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>}
            <div className="photo-shade" />
            <div className="profile-heading"><h2>{profile.displayName}</h2><p>{[profile.gender, profile.college?.name].filter(Boolean).join(' · ')}</p></div>
          </div>
          <div className="profile-copy">
            <p className="study-line">{[profile.course?.name, profile.semester?.name].filter(Boolean).join(' · ')}</p>
            {profile.bio && <p className="bio">{profile.bio}</p>}
            <div className="interest-list">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
          </div>
        </article>}
        {!loading && !error && !profile && <div className="state-panel"><strong>You&apos;re all caught up.</strong><p>There are no more eligible profiles right now.</p><button className="secondary-button" onClick={() => void loadProfiles()}>Check again</button></div>}
      </section>
      <div className="action-row" aria-label="Profile actions">
        <button className="action-button pass" aria-label="Pass profile" disabled={!profile || busy} onClick={() => void choose('pass')}>×<span>Pass</span></button>
        <button className="action-button like" aria-label="Like profile" disabled={!profile || busy} onClick={() => void choose('like')}>♥<span>Like</span></button>
      </div>
      <nav className="bottom-nav" aria-label="Main navigation">
        <a className="active" href="/discover">Discover</a><a href="/matches">Matches</a><a href="/messages">Messages</a><a href="/profile">Profile</a>
      </nav>
      {match && <div className="match-overlay" role="dialog" aria-modal="true" aria-labelledby="match-title"><div className="match-dialog"><span className="match-mark">♥</span><p className="eyebrow">Mutual interest</p><h2 id="match-title">It&apos;s a Match!</h2><p>You and {match.displayName} liked each other.</p><div className="match-actions"><a className="primary-button" href="/messages">Send a message</a><button className="secondary-button" onClick={() => setMatch(null)}>Keep discovering</button></div></div></div>}
    </main>
  );
}