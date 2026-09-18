'use client';

import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Overview = { successfulPayments: number; grossAmountInPaise: number; activePremiumUsers: number; boostsPurchased: number; failedPayments: number };
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value / 100);

export default function AdminPaymentsPage() {
  const [overview, setOverview] = useState<Overview | null>(null); const [error, setError] = useState('');
  useEffect(() => { fetch(`${apiUrl}/api/v1/admin/payments/overview`, { credentials: 'include' }).then(async (response) => { const result = await response.json() as { data?: Overview; error?: { message: string } }; if (!response.ok) throw new Error(result.error?.message ?? 'Admin access required'); setOverview(result.data ?? null); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load payment overview.')); }, []);
  return <main className="app-shell"><header className="topbar"><div><span className="eyebrow">Operations</span><h1>Payments</h1></div><a className="icon-button" href="/profile" aria-label="Back to profile">×</a></header>{error ? <div className="state-panel page-state"><strong>{error}</strong><p>This area is available to administrator accounts only.</p></div> : <section className="admin-grid">{overview ? <><article><span className="eyebrow">Successful payments</span><strong>{overview.successfulPayments}</strong></article><article><span className="eyebrow">Gross collected</span><strong>{money(overview.grossAmountInPaise)}</strong></article><article><span className="eyebrow">Active Premium</span><strong>{overview.activePremiumUsers}</strong></article><article><span className="eyebrow">Boost purchases</span><strong>{overview.boostsPurchased}</strong></article><article><span className="eyebrow">Failed payments</span><strong>{overview.failedPayments}</strong></article></> : <div className="state-panel"><p>Loading overview...</p></div>}</section>}<nav className="bottom-nav" aria-label="Main navigation"><a href="/discover">Discover</a><a href="/matches">Matches</a><a href="/messages">Messages</a><a href="/profile">Profile</a></nav></main>;
}