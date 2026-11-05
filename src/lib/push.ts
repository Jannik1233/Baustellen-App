import { VAPID_PUBLIC_KEY } from '../verbindung';
// Benachrichtigungen auf dem Handy. Auf dem iPhone nur, wenn die App auf dem Startbildschirm liegt (ab iOS 16.4).

import type { Datenquelle } from './datenquelle';

export type PushZustand = 'nicht-moeglich' | 'startbildschirm-noetig' | 'abgelehnt' | 'aus' | 'an';

export const istIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const vomStartbildschirm = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function pushZustand(): Promise<PushZustand> {
  if (istIphone() && !vomStartbildschirm()) return 'startbildschirm-noetig';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'nicht-moeglich';
  if (Notification.permission === 'denied') return 'abgelehnt';
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  return abo ? 'an' : 'aus';
}

function schluesselBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const roh = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(roh, (c) => c.charCodeAt(0));
}

export async function pushEinschalten(quelle: Datenquelle, personId: string): Promise<string | null> {
  const schluessel = VAPID_PUBLIC_KEY;
  if (quelle.modus === 'demo') return 'Im Demo-Modus gibt es keine Benachrichtigungen.';
  if (!schluessel) return 'Benachrichtigungen sind noch nicht eingerichtet.';
  const erlaubt = await Notification.requestPermission();
  if (erlaubt !== 'granted') return 'Benachrichtigungen wurden nicht erlaubt. Das lässt sich in den Einstellungen des Handys ändern.';
  const reg = await navigator.serviceWorker.ready;
  const abo =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(schluessel) }));
  await quelle.pushAbonnieren(abo.toJSON(), personId);
  return null;
}
