/// <reference lib="webworker" />
// Service Worker: hält die App für den Offline-Betrieb vor und zeigt Benachrichtigungen an.

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.addEventListener('install', () => void self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Der Server schickt nur Titel, kurzen Text und Ziel in der App, keine persönlichen Inhalte
self.addEventListener('push', (e) => {
  let nachricht = { titel: 'Frohes Schaffen', text: 'Es gibt Neuigkeiten.', ziel: '/' };
  try {
    nachricht = { ...nachricht, ...(e.data?.json() as Partial<typeof nachricht>) };
  } catch {
    // ohne lesbaren Inhalt die allgemeine Nachricht zeigen
  }
  e.waitUntil(
    self.registration.showNotification(nachricht.titel, {
      body: nachricht.text,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { ziel: nachricht.ziel },
      tag: nachricht.ziel
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const ziel = (e.notification.data as { ziel?: string } | undefined)?.ziel ?? '/';
  e.waitUntil(
    (async () => {
      const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const offen = fenster[0] as WindowClient | undefined;
      const url = new URL('/#' + ziel, self.location.origin).href;
      if (offen) {
        await offen.navigate(url).catch(() => undefined);
        return offen.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
