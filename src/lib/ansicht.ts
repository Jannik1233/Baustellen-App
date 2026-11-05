// Häufig gebrauchte Ableitungen aus dem Datenbestand für die Seiten
import { useMemo } from 'react';
import { useDaten } from './daten';
import { isoDatum } from './arbeitstage';
import { heuteIso, kalenderwoche, montagDerWoche, plusTage } from './regeln';
import type { Bestaetigung, Bestand, Einsatz, Planfassung } from './types';

export interface OffeneBestaetigung {
  bestaetigung: Bestaetigung;
  fassung: Planfassung;
  kw: number;
}

// Noch nicht bestätigte Planänderungen des Benutzers, nur für die laufende und künftige Wochen
export function offeneBestaetigungen(daten: Bestand, personId: string): OffeneBestaetigung[] {
  const ab = montagDerWoche(heuteIso());
  const fassungen = new Map(daten.planfassungen.map((f) => [f.id, f]));
  return daten.bestaetigungen
    .filter((b) => b.personId === personId && !b.bestaetigtAm)
    .map((b) => ({ bestaetigung: b, fassung: fassungen.get(b.planfassungId)! }))
    .filter((x) => x.fassung && x.fassung.woche >= ab)
    .sort((a, b) => a.fassung.woche.localeCompare(b.fassung.woche) || a.fassung.veroeffentlichtAm.localeCompare(b.fassung.veroeffentlichtAm))
    .map((x) => ({ ...x, kw: kalenderwoche(x.fassung.woche) }));
}

export function useOffeneBestaetigung(): OffeneBestaetigung | null {
  const { daten, benutzer } = useDaten();
  return useMemo(() => (benutzer ? offeneBestaetigungen(daten, benutzer.id)[0] ?? null : null), [daten, benutzer]);
}

export function useNamen() {
  const { daten } = useDaten();
  return useMemo(() => {
    const personen = new Map(daten.personen.map((p) => [p.id, p.name]));
    const baustellen = new Map(daten.baustellen.map((b) => [b.id, b.name]));
    const maschinen = new Map(daten.maschinen.map((m) => [m.id, m.bezeichnung]));
    return {
      person: (id: string | null | undefined) => (id ? personen.get(id) ?? 'Unbekannt' : ''),
      baustelle: (id: string | null | undefined) => (id ? baustellen.get(id) ?? 'Baustelle nicht sichtbar' : 'Ohne Baustelle'),
      maschine: (id: string | null | undefined) => (id ? maschinen.get(id) ?? 'Maschine' : '')
    };
  }, [daten.personen, daten.baustellen, daten.maschinen]);
}

export function einsaetzeAm(einsaetze: Einsatz[], personId: string, datum: string): Einsatz[] {
  return einsaetze.filter((e) => e.personId === personId && e.datum === datum).sort((a, b) => a.beginn.localeCompare(b.beginn));
}

// Vorschlag für die Baustelle einer Meldung: wo der Benutzer heute eingeplant ist
export function useHeutigeBaustelle(): string | null {
  const { daten, benutzer } = useDaten();
  return useMemo(() => {
    if (!benutzer) return null;
    return einsaetzeAm(daten.einsaetze, benutzer.id, heuteIso())[0]?.baustelleId ?? null;
  }, [daten.einsaetze, benutzer]);
}

export function uhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function zeitpunkt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const tag = isoDatum(d);
  const heute = heuteIso();
  if (tag === heute) return `heute ${uhrzeit(iso)}`;
  if (tag === plusTage(heute, -1)) return `gestern ${uhrzeit(iso)}`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${uhrzeit(iso)}`;
}

// "Gelesen" für eine Planänderung. Bestätigt gleich alle offenen derselben Woche mit.
export function useBestaetigen() {
  const { daten, benutzer, speichern } = useDaten();
  return async (woche: string) => {
    if (!benutzer) return;
    const jetzt = new Date().toISOString();
    for (const o of offeneBestaetigungen(daten, benutzer.id).filter((x) => x.fassung.woche === woche))
      await speichern('bestaetigungen', { ...o.bestaetigung, bestaetigtAm: jetzt });
  };
}
