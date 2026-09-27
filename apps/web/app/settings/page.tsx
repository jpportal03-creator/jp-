'use client';

import { apiUrl } from '@/lib/config';
import AppNavigation from '../components/AppNavigation';
import { FormEvent, useEffect, useState } from 'react';

type BlockedUser = { userId: string; blockedAt: string; profile: { displayName: string; profilePhotoUrl: string | null } | null };
type ProfilePrivacy = { discoverability: 'discoverable' | 'hidden' | 'incognito'; hideExactLocation: boolean; showGender: boolean; showCollege: boolean };
const defaultPrivacy: ProfilePrivacy = { discoverability: 'discoverable', hideExactLocation: true, showGender: true, showCollege: true };

export default function SettingsPage() {
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const [profileResponse, blocksResponse] = await Promise.all([
        fetch(`${apiUrl}/api/v1/profile/me`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/v1/blocks`, { credentials: 'include' }),
      ]);
      if (profileResponse.status === 401 || blocksResponse.status === 401) { window.location.href = '/login'; return; }
      const profileResult = await profileResponse.json() as { data?: { profile: { discoverability: ProfilePrivacy['discoverability']; privacySettings: Partial<ProfilePrivacy> | null } | null } };
      const blockResult = await blocksResponse.json() as { data?: { items: BlockedUser[] } };
      if (!profileResponse.ok || !blocksResponse.ok || !profileResult.data || !blockResult.data) throw new Error('Could not load settings.');
      const profile = profileResult.data.profile;
      if (profile) setPrivacy({ ...defaultPrivacy, ...profile.privacySettings, discoverability: profile.discoverability });
      setBlockedUsers(blockResult.data.items);
    } catch (reason) {
      setError('We could not load settings. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSettings(); }, []);

  async function updatePrivacy(patch: Partial<ProfilePrivacy>) {
    const previous = privacy;
    setPrivacy((current) => ({ ...current, ...patch }));
    setNotice(''); setError('');
    try {
      const response = await fetch(`${apiUrl}/api/v1/profile/privacy`, { method: 'PATCH', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
      if (!response.ok) throw new Error('Could not save privacy settings.');
      setNotice('Privacy settings saved.');
    } catch (reason) {
      setPrivacy(previous);
      setError(reason instanceof Error ? reason.message : 'Could not save privacy settings.');
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(''); setError('');
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/password`, { method: 'PUT', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(passwords) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not change password.');
      window.location.href = '/login';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not change password.');
    } finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    await fetch(`${apiUrl}/api/v1/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
  }

  async function unblock(userId: string) {
    try {
      const response = await fetch(`${apiUrl}/api/v1/blocks/${userId}`, { method: 'DELETE', credentials: 'include' });
      if (!response.ok) throw new Error('Could not unblock this account.');
      setBlockedUsers((items) => items.filter((item) => item.userId !== userId));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not unblock this account.'); }
  }

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    if (deleteText !== 'DELETE') { setError('Type DELETE to confirm account deletion.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/account`, { method: 'DELETE', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: deletePassword, confirmation: deleteText }) });
      const result = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Could not delete account.');
      window.location.href = '/';
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not delete account.'); }
    finally { setBusy(false); }
  }

  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Account controls</span><h1>Settings</h1></div></header>
    {loading && <div className="state-panel"><p>Loading settings...</p></div>}
    {!loading && error && <div className="state-panel"><strong>Settings are unavailable.</strong><p>{error}</p><button className="primary-button" onClick={() => void loadSettings()}>Try again</button></div>}
    {!loading && <div className="settings-sections">
      <section className="settings-section"><h2>Account</h2><a className="settings-link" href="/profile/edit">Edit Profile <span>→</span></a>
        <form className="settings-form" onSubmit={(event) => void changePassword(event)}><h3>Change password</h3><label className="setup-field">Current password<input type="password" autoComplete="current-password" minLength={8} required value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} /></label><label className="setup-field">New password<input type="password" autoComplete="new-password" minLength={8} required value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} /></label><button className="secondary-button" disabled={busy}>Update password</button></form>
        <button className="secondary-button" onClick={() => void logout()} disabled={busy}>Log out</button>
      </section>
      <section className="settings-section"><h2>Dating preferences</h2><p>Manage who you are interested in and what you are looking for.</p><a className="settings-link" href="/profile/edit">Edit dating preferences <span>→</span></a></section>
      <section className="settings-section"><h2>Privacy</h2><label className="setup-field">Profile visibility<select value={privacy.discoverability} onChange={(event) => void updatePrivacy({ discoverability: event.target.value as ProfilePrivacy['discoverability'] })}><option value="discoverable">Discoverable</option><option value="hidden">Hidden</option><option value="incognito">Incognito</option></select></label>
        <label className="settings-toggle"><input type="checkbox" checked={privacy.showGender} onChange={(event) => void updatePrivacy({ showGender: event.target.checked })} /> Show gender on my profile</label>
        <label className="settings-toggle"><input type="checkbox" checked={privacy.showCollege} onChange={(event) => void updatePrivacy({ showCollege: event.target.checked })} /> Show college on my profile</label>
      </section>
      <section className="settings-section"><h2>Safety</h2><h3>Blocked users</h3>{blockedUsers.length === 0 ? <p>No blocked users.</p> : blockedUsers.map((item) => <div className="blocked-row" key={item.userId}><span>{item.profile?.displayName ?? 'JP Dating member'}</span><button className="secondary-button" onClick={() => void unblock(item.userId)}>Unblock</button></div>)}<a className="settings-link" href="/legal/community">Safety information <span>→</span></a><p>Report someone from their Discovery profile or conversation menu.</p></section>
      <section className="settings-section destructive-section"><h2>Delete account</h2><p>Your account will be deactivated and your sessions revoked. This action cannot be undone from the app.</p><button className="danger-button" onClick={() => { setConfirmDelete(true); setError(''); }}>Delete account</button></section>
      {notice && <p className="settings-notice" role="status">{notice}</p>}
    </div>}
    {confirmDelete && <div className="confirm-overlay" role="presentation"><form className="confirm-dialog" onSubmit={(event) => void deleteAccount(event)}><h2>Delete your account?</h2><p>Enter your password and type DELETE to confirm. Your active sessions will be revoked.</p><label className="setup-field">Password<input type="password" autoComplete="current-password" minLength={8} required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} /></label><label className="setup-field">Type DELETE to confirm<input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="setup-actions"><button className="secondary-button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="danger-button" type="submit" disabled={busy}>Delete account</button></div></form></div>}
    <AppNavigation />
  </main>;
}
