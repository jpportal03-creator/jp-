'use client';

import { useEffect, useState } from 'react';

export default function PwaClient() {
  const [offline, setOffline] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const browser = globalThis as unknown as BrowserWindow;
    setOffline(!browser.navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    browser.addEventListener('online', onOnline);
    browser.addEventListener('offline', onOffline);
    browser.addEventListener('beforeinstallprompt', onInstall);
    if (browser.navigator.serviceWorker) void browser.navigator.serviceWorker.register('/sw.js');
    return () => {
      browser.removeEventListener('online', onOnline);
      browser.removeEventListener('offline', onOffline);
      browser.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }

  return <>{offline && <div className="offline-banner" role="status">You&apos;re offline. Reconnect to continue matching and chatting.</div>}{installEvent && <button className="install-button" onClick={() => void install()}>Install JP Dating</button>}</>;
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };
type BrowserWindow = {
  navigator: { onLine: boolean; serviceWorker?: { register: (path: string) => Promise<unknown> } };
  addEventListener: (name: string, listener: (event: Event) => void) => void;
  removeEventListener: (name: string, listener: (event: Event) => void) => void;
};
