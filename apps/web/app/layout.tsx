import type { Metadata } from 'next';
import './globals.css';
import PwaClient from './pwa-client';
import { siteUrl } from '@/lib/config';

export const metadata: Metadata = {
  title: 'JP Dating',
  description: 'An independently operated student social and dating platform.',
  metadataBase: new URL(siteUrl),
  alternates: { canonical: '/' },
  openGraph: { title: 'JP Dating', description: 'An independently operated student social and dating platform.', type: 'website' },
  twitter: { card: 'summary', title: 'JP Dating', description: 'An independently operated student social and dating platform.' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><PwaClient />{children}</body>
    </html>
  );
}
