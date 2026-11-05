import type { PlanAenderung } from './regeln';
import type { Person, Planfassung, Tabellen, TabellenName } from './types';

// Gemeinsame Schnittstelle für den Demo-Modus (alles im Browser) und den Echtbetrieb (Supabase).
export interface Datenquelle {
  modus: 'demo' | 'online';
  aktuellerBenutzer(): Promise<Person | null>;
  abmelden(): Promise<void>;
  laden<T extends TabellenName>(tabelle: T): Promise<Tabellen[T][]>;
  speichern<T extends TabellenName>(tabelle: T, zeile: Tabellen[T]): Promise<Tabellen[T]>;
  loeschen(tabelle: TabellenName, id: string): Promise<void>;
  dateiHochladen(pfad: string, datei: Blob): Promise<void>;
  dateiLaden(pfad: string): Promise<Blob>;
  // Übernimmt den Entwurf einer Woche in einem Schritt und benachrichtigt die Betroffenen
  planVeroeffentlichen(montag: string, aenderung: PlanAenderung, hinweis: string): Promise<Planfassung>;
  pushAbonnieren(abo: PushSubscriptionJSON, personId: string): Promise<void>;
}

export function neueId(): string {
  return crypto.randomUUID();
}

// Fehler, bei denen es sich lohnt, später erneut zu senden (kein Netz, Server kurz weg)
export function istNetzfehler(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (e instanceof TypeError) return true; // fetch ohne Verbindung
  const text = e instanceof Error ? e.message : String(e);
  return /fetch|network|netz|timeout|Failed to fetch|Load failed/i.test(text);
}
