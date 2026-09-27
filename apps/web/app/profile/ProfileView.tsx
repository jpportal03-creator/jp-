'use client';

import { apiUrl } from '@/lib/config';
import AppNavigation from '../components/AppNavigation';
import { useEffect, useState } from 'react';

type Profile = {
  displayName: string;
  age: number | null;
  academicYear: number | null;
  gender: string | null;
  interestedIn: string | null;
  lookingFor: string | null;
  interests: string[];
  bio: string | null;
  profilePhotoUrl: string | null;
  college: { name: string } | null;
  course: { name: string } | null;
  semester: { name: string } | null;
};

const preferenceLabels: Record<string, string> = {
  men: 'Men', women: 'Women', everyone: 'Everyone', dating: 'Dating', relationship: 'Relationship',
  casual_dating: 'Casual dating', hookup: 'Hookup', friendship: 'Friendship',
  open_to_see_where_it_goes: 'Open to see where it goes',
};

export default function ProfileView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/v1/profile/me`, { credentials: 'include' });
      const result = await response.json() as { data?: { profile: Profile | null }; error?: { message?: string } };
      if (response.status === 401) { window.location.href = '/login'; return; }
      if (!response.ok || !result.data) throw new Error('Could not load your profile.');
      if (!result.data.profile) { window.location.href = '/profile/setup'; return; }
      setProfile(result.data.profile);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, []);

  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Your presence</span><h1>Profile</h1></div><a className="secondary-button" href="/settings">Settings</a></header>
    {loading && <div className="state-panel"><p>Loading your profile...</p></div>}
    {!loading && error && <div className="state-panel"><strong>Profile unavailable.</strong><p>{error}</p><button className="primary-button" onClick={() => void loadProfile()}>Try again</button></div>}
    {!loading && !error && profile && <section className="own-profile">
      <div className="own-profile-hero">
        {profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="Your profile" /> : <span className="avatar-fallback">{profile.displayName.slice(0, 1).toUpperCase()}</span>}
        <div><h2>{profile.displayName}{profile.age ? `, ${profile.age}` : ''}</h2><p>{[profile.gender, profile.college?.name].filter(Boolean).join(' · ')}</p></div>
      </div>
      <dl className="own-profile-details">
        <div><dt>College</dt><dd>{profile.college?.name ?? 'Not set'}</dd></div>
        <div><dt>Course</dt><dd>{profile.course?.name ?? 'Not set'}</dd></div>
        <div><dt>Academic year</dt><dd>{profile.academicYear ? `Year ${profile.academicYear}` : profile.semester?.name ?? 'Not set'}</dd></div>
        <div><dt>Interested in</dt><dd>{profile.interestedIn ? preferenceLabels[profile.interestedIn] : 'Not set'}</dd></div>
        <div><dt>Looking for</dt><dd>{profile.lookingFor ? preferenceLabels[profile.lookingFor] : 'Not set'}</dd></div>
      </dl>
      {profile.bio && <p className="own-profile-bio">{profile.bio}</p>}
      <div className="interest-list">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
      <a className="primary-button own-profile-edit" href="/profile/edit">Edit Profile</a>
    </section>}
    <AppNavigation />
  </main>;
}
