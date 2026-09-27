'use client';

import { usePathname } from 'next/navigation';

const navigationItems = [
  { label: 'Discover', href: '/discover', marker: '◉' },
  { label: 'Matches', href: '/matches', marker: '♥' },
  { label: 'Chat', href: '/chat', marker: '◌' },
  { label: 'Profile', href: '/profile', marker: '○' },
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="app-navigation" aria-label="Main navigation">
      {navigationItems.map((item) => {
        const active = item.href === '/chat'
          ? pathname.startsWith('/chat')
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <a className={active ? 'active' : ''} href={item.href} aria-current={active ? 'page' : undefined} key={item.href}>
          <span className="app-navigation-marker" aria-hidden="true">{item.marker}</span>
          <span>{item.label}</span>
        </a>;
      })}
    </nav>
  );
}