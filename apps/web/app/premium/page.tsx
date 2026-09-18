'use client';

import { useEffect, useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type Plan = { code: string; name: string; description: string | null; durationDays: number; priceInPaise: number; currency: string; interval: string };
type SubscriptionState = { premium: boolean; subscription: { status: string; endsAt: string | null; plan: Plan } | null };

const formatPrice = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount / 100);

export default function PremiumPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<SubscriptionState | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/api/v1/subscription/plans`, { credentials: 'include' }).then((response) => response.json() as Promise<{ data: Plan[] }>),
      fetch(`${apiUrl}/api/v1/subscription/me`, { credentials: 'include' }).then((response) => response.json() as Promise<{ data: SubscriptionState }>),
    ]).then(([planResult, subscriptionResult]) => { setPlans(planResult.data ?? []); setCurrent(subscriptionResult.data ?? null); }).catch(() => setMessage('Premium plans are temporarily unavailable.'));
  }, []);

  async function choosePlan(planCode: string) {
    setBusy(true); setMessage('Creating a secure payment order...'); setCheckoutUrl(null);
    try {
      const response = await fetch(`${apiUrl}/api/v1/subscription/create`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planCode }) });
      const result = await response.json() as { data?: { checkoutUrl: string }; error?: { message: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? 'Payment could not be started.');
      setCheckoutUrl(result.data.checkoutUrl); setMessage('Order created. Premium activates only after payment verification.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Payment could not be started.'); } finally { setBusy(false); }
  }

  return <main className="app-shell premium-page"><header className="topbar"><div><span className="eyebrow">More control, when you want it</span><h1>Premium</h1></div><a className="icon-button" href="/profile" aria-label="Back to profile">×</a></header><section className="premium-intro"><span className="premium-star">✦</span><h2>Upgrade Your JP Dating Experience</h2><p>Choose a plan that fits you. Your access is activated only after the payment provider confirms it.</p></section>{current?.premium && <div className="active-plan"><span className="eyebrow">Current plan</span><strong>{current.subscription?.plan.name} Premium</strong><p>Active until {current.subscription?.endsAt ? new Date(current.subscription.endsAt).toLocaleDateString() : 'your renewal date'}.</p><a href="/settings/subscription">Manage subscription</a></div>}<section className="plan-grid">{plans.map((plan) => <article className="plan-card" key={plan.code}><div><span className="eyebrow">{plan.name}</span><strong>{formatPrice(plan.priceInPaise)}</strong><p>{plan.description}</p><small>{plan.durationDays} days · {plan.interval} billing</small></div><button className="primary-button" disabled={busy || current?.premium === true} onClick={() => void choosePlan(plan.code)}>{current?.premium ? 'Already active' : 'Choose plan'}</button></article>)}</section><ul className="benefit-list"><li>Advanced discovery preferences</li><li>More visibility controls</li><li>Optional Premium profile styling</li></ul>{message && <p className="payment-message" role="status">{message}</p>}{checkoutUrl && <a className="primary-button checkout-link" href={checkoutUrl}>Continue to secure checkout</a>}<p className="fine-print">Plans and prices are supplied by the server. Payment status is verified before access is granted.</p><nav className="bottom-nav" aria-label="Main navigation"><a href="/discover">Discover</a><a href="/matches">Matches</a><a href="/messages">Messages</a><a className="active" href="/profile">Profile</a></nav></main>;
}