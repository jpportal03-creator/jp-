'use client';

import { useEffect, useState } from 'react';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  useEffect(() => { fetch(`${apiUrl}/api/v1/notifications`, { credentials: 'include' }).then((response) => response.json() as Promise<{ data: { items: Notification[] } }>).then((result) => setItems(result.data?.items ?? [])); }, []);
  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Stay in the loop</span><h1>Notifications</h1></div></header><section className="notification-list">{items.length === 0 ? <div className="state-panel"><strong>Nothing new.</strong><p>Important match and message updates will appear here.</p></div> : items.map((item) => <article className={`notification-row ${item.readAt ? '' : 'unread'}`} key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleDateString()}</small></article>)}</section><nav className="bottom-nav" aria-label="Main navigation"><a href="/discover">Discover</a><a href="/matches">Matches</a><a href="/messages">Messages</a><a href="/profile">Profile</a></nav></main>;
}