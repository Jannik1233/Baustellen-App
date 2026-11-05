// Fachliche Regeln ohne Oberfläche: Planung, Jugendarbeitsschutz, Urlaub, Prüftermine.
// Alles hier ist reine Logik und durch Tests abgesichert (regeln.test.ts).

import { feiertageSachsen, isoDatum, istArbeitstag, parseDatum } from './arbeitstage';
import type { Abwesenheit, Einsatz, Einstellungen, Person, Pruefung, Urlaubskonto } from './types';

export function plusTage(iso: string, n: number): string {
  const d = parseDatum(iso);
  d.setDate(d.getDate() + n);
  return isoDatum(d);
}

// Montag der Woche, in der das Datum liegt
export function montagDerWoche(iso: string): string {
  const d = parseDatum(iso);
  const wt = (d.getDay() + 6) % 7; // Montag = 0
  return plusTage(iso, -wt);
}

export function tageDerWoche(montag: string, anzahl = 5): string[] {
  return Array.from({ length: anzahl }, (_, i) => plusTage(montag, i));
}

// Kalenderwoche nach ISO 8601
export function kalenderwoche(iso: string): number {
  const d = parseDatum(iso);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const ersterDonnerstag = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - ersterDonnerstag.getTime()) / 864e5 - 3 + ((ersterDonnerstag.getDay() + 6) % 7)) / 7);
}

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const wochentag = (iso: string) => WOCHENTAGE[parseDatum(iso).getDay()];
export const wochentagKurz = (iso: string) => wochentag(iso).slice(0, 2);

export function datumLang(iso: string): string {
  const [j, m, t] = iso.split('-');
  return `${wochentag(iso)}, ${t}.${m}.${j}`;
}

export function datumKurz(iso: string | null | undefined): string {
  if (!iso) return '';
  const [j, m, t] = iso.slice(0, 10).split('-');
  return `${t}.${m}.${j.slice(2)}`;
}

export const feiertag = (iso: string) => feiertageSachsen(Number(iso.slice(0, 4))).get(iso) ?? null;

export function standardZeiten(datum: string, e: Einstellungen): { beginn: string; ende: string } {
  const freitag = parseDatum(datum).getDay() === 5;
  return { beginn: e.beginn, ende: freitag ? e.endeFreitag : e.ende };
}

const minuten = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

// Arbeitszeit ohne Pausen in Stunden. Pausen nach Jugendarbeitsschutzgesetz (§ 11) bzw. Arbeitszeitgesetz (§ 4).
export function nettoStunden(beginn: string, ende: string, jugendlich: boolean): number {
  const brutto = Math.max(0, minuten(ende) - minuten(beginn));
  let pause = 0;
  if (jugendlich) pause = brutto > 6 * 60 ? 60 : brutto > 4.5 * 60 ? 30 : 0;
  else pause = brutto > 9 * 60 ? 45 : brutto > 6 * 60 ? 30 : 0;
  return Math.max(0, brutto - pause) / 60;
}

export const istJugendlich = (p: Person, datum: string) => Boolean(p.jugendlichBis && datum < p.jugendlichBis);

// Liegt das Datum in einer genehmigten Abwesenheit dieser Person?
export function abwesenheitAm(personId: string, datum: string, abwesenheiten: Abwesenheit[]): Abwesenheit | null {
  return (
    abwesenheiten.find((a) => a.personId === personId && a.status === 'genehmigt' && a.von <= datum && datum <= a.bis) ?? null
  );
}

export const ABWESENHEIT_TEXT: Record<Abwesenheit['art'], string> = {
  urlaub: 'Urlaub',
  abwesend: 'Abwesend',
  berufsschule: 'Berufsschule',
  sonstiges: 'Frei'
};

export interface Warnung {
  personId: string;
  datum: string | null; // null = betrifft die ganze Woche
  text: string;
}

// Prüft den Plan einer Woche. Warnt nur, verbietet nichts: die Entscheidung bleibt beim Büro.
// Jugendarbeitsschutz vereinfacht nach §§ 8, 9, 14, 15, 16, 17 JArbSchG. Vor dem Echtbetrieb gegen den Gesetzestext prüfen.
export function planWarnungen(
  montag: string,
  personen: Person[],
  einsaetze: Einsatz[],
  abwesenheiten: Abwesenheit[]
): Warnung[] {
  const tage = tageDerWoche(montag, 7);
  const warnungen: Warnung[] = [];
  for (const p of personen) {
    const eigene = einsaetze.filter((e) => e.personId === p.id && tage.includes(e.datum));
    let wochenStunden = 0;
    const arbeitstage = new Set<string>();
    for (const e of eigene) {
      const abw = abwesenheitAm(p.id, e.datum, abwesenheiten);
      if (abw) warnungen.push({ personId: p.id, datum: e.datum, text: `An diesem Tag eingetragen: ${ABWESENHEIT_TEXT[abw.art]}` });
      const ft = feiertag(e.datum);
      if (ft) warnungen.push({ personId: p.id, datum: e.datum, text: `Feiertag: ${ft}` });
      const jugendlich = istJugendlich(p, e.datum);
      const std = nettoStunden(e.beginn, e.ende, jugendlich);
      wochenStunden += std;
      arbeitstage.add(e.datum);
      if (!jugendlich) continue;
      const wt = parseDatum(e.datum).getDay();
      if (wt === 0 || wt === 6) warnungen.push({ personId: p.id, datum: e.datum, text: 'Jugendliche: am Wochenende nicht einplanen' });
      if (std > 8.5) warnungen.push({ personId: p.id, datum: e.datum, text: `Jugendliche: ${fmtStunden(std)} Stunden, erlaubt sind höchstens 8,5` });
      if (minuten(e.beginn) < 6 * 60 || minuten(e.ende) > 20 * 60)
        warnungen.push({ personId: p.id, datum: e.datum, text: 'Jugendliche: Arbeit nur zwischen 6 und 20 Uhr' });
    }
    const jugendlichInWoche = eigene.some((e) => istJugendlich(p, e.datum));
    if (!jugendlichInWoche) continue;
    if (wochenStunden > 40) warnungen.push({ personId: p.id, datum: null, text: `Jugendliche: ${fmtStunden(wochenStunden)} Stunden in der Woche, erlaubt sind 40` });
    if (arbeitstage.size > 5) warnungen.push({ personId: p.id, datum: null, text: 'Jugendliche: höchstens 5 Arbeitstage pro Woche' });
  }
  return warnungen;
}

export const fmtStunden = (h: number) => h.toLocaleString('de-DE', { maximumFractionDigits: 2 });

// Was sich zwischen dem veröffentlichten Plan und dem Entwurf einer Woche ändert
export interface PlanAenderung {
  speichern: Einsatz[]; // neu oder geändert
  loeschen: string[];
  betroffene: string[]; // Personen, die benachrichtigt werden und bestätigen müssen
}

const gleich = (a: Einsatz, b: Einsatz) =>
  a.personId === b.personId && a.baustelleId === b.baustelleId && a.datum === b.datum && a.beginn === b.beginn && a.ende === b.ende && a.notiz === b.notiz;

export function planDiff(alt: Einsatz[], neu: Einsatz[]): PlanAenderung {
  const altNachId = new Map(alt.map((e) => [e.id, e]));
  const neuIds = new Set(neu.map((e) => e.id));
  const speichern = neu.filter((e) => {
    const vorher = altNachId.get(e.id);
    return !vorher || !gleich(vorher, e);
  });
  const geloescht = alt.filter((e) => !neuIds.has(e.id));
  const betroffene = new Set<string>();
  for (const e of speichern) {
    betroffene.add(e.personId);
    const vorher = altNachId.get(e.id);
    if (vorher) betroffene.add(vorher.personId);
  }
  for (const e of geloescht) betroffene.add(e.personId);
  return { speichern, loeschen: geloescht.map((e) => e.id), betroffene: [...betroffene].sort() };
}

// Welche Baustellen ein Mitarbeiter sehen darf: eingeplant von 14 Tagen zurück bis 28 Tage voraus.
// Die Datenbank setzt dieselbe Regel durch (Funktion sichtbare_baustellen).
export const SICHT_ZURUECK = 14;
export const SICHT_VORAUS = 28;

export function sichtbareBaustellenIds(personId: string, einsaetze: Einsatz[], heute: string): Set<string> {
  const von = plusTage(heute, -SICHT_ZURUECK);
  const bis = plusTage(heute, SICHT_VORAUS);
  return new Set(einsaetze.filter((e) => e.personId === personId && e.datum >= von && e.datum <= bis).map((e) => e.baustelleId));
}

// Urlaubstage = Arbeitstage im Zeitraum (ohne Wochenende und Feiertage in Sachsen)
export function urlaubstage(von: string, bis: string): number {
  let n = 0;
  for (let d = von; d <= bis; d = plusTage(d, 1)) if (istArbeitstag(parseDatum(d))) n++;
  return n;
}

export interface Urlaubsstand {
  anspruch: number;
  genommenLautWinworker: number;
  standVom: string | null;
  seitdemGenehmigt: number;
  beantragt: number;
  rest: number;
}

// Resturlaub: Anspruch minus Stand aus WinWorker minus seitdem genehmigter Urlaub
export function urlaubsstand(personId: string, jahr: number, konten: Urlaubskonto[], abwesenheiten: Abwesenheit[]): Urlaubsstand {
  const konto = konten.find((k) => k.personId === personId && k.jahr === jahr);
  const stand = konto?.standVom ?? `${jahr}-01-01`;
  const jahresStart = `${jahr}-01-01`;
  const jahresEnde = `${jahr}-12-31`;
  let seitdemGenehmigt = 0;
  let beantragt = 0;
  for (const a of abwesenheiten) {
    if (a.personId !== personId || a.art !== 'urlaub' || a.status === 'abgelehnt') continue;
    // nur der Teil im Jahr und nach dem Stand aus WinWorker
    const von = [a.von, jahresStart, plusTage(stand, 1)].sort().at(-1)!;
    const bis = [a.bis, jahresEnde].sort()[0];
    if (von > bis) continue;
    const tage = urlaubstage(von, bis);
    if (a.status === 'genehmigt') seitdemGenehmigt += tage;
    else beantragt += tage;
  }
  const anspruch = konto?.anspruch ?? 0;
  const genommen = konto?.genommen ?? 0;
  return {
    anspruch,
    genommenLautWinworker: genommen,
    standVom: konto?.standVom ?? null,
    seitdemGenehmigt,
    beantragt,
    rest: anspruch - genommen - seitdemGenehmigt
  };
}

export function plusMonate(iso: string, monate: number): string {
  const d = parseDatum(iso);
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + monate);
  const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, letzter));
  return isoDatum(d);
}

export type PruefStatus = 'ueberfaellig' | 'bald' | 'ok' | 'unbekannt';

export function naechstePruefung(p: Pruefung): string | null {
  return p.zuletzt ? plusMonate(p.zuletzt, p.intervallMonate) : null;
}

export function pruefStatus(p: Pruefung, heute: string, vorlaufTage = 30): PruefStatus {
  const naechste = naechstePruefung(p);
  if (!naechste) return 'unbekannt';
  if (naechste < heute) return 'ueberfaellig';
  if (naechste <= plusTage(heute, vorlaufTage)) return 'bald';
  return 'ok';
}

export function heuteIso(): string {
  return isoDatum(new Date());
}

// "bis voraussichtlich" aus der Krankmeldung: 1 Tag = heute, 3 Tage = bis übermorgen usw. (Arbeitstage)
export function bisNachArbeitstagen(ab: string, arbeitstage: number): string {
  let d = ab;
  let n = istArbeitstag(parseDatum(d)) ? 1 : 0;
  while (n < arbeitstage) {
    d = plusTage(d, 1);
    if (istArbeitstag(parseDatum(d))) n++;
  }
  return d;
}

export function adresse(b: { strasse: string; plz: string; ort: string }): string {
  return [b.strasse, [b.plz, b.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// Link, der auf iPhone und Android die Navigation öffnet
export function navigationsLink(b: { strasse: string; plz: string; ort: string }): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse(b))}`;
}

export function telefonLink(nummer: string): string {
  return `tel:${nummer.replace(/[^\d+]/g, '')}`;
}
