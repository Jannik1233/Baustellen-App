// Übernahme der Projektliste aus WinWorker.
// WinWorker exportiert als CSV oder Excel. Excel-Dateien bitte in Excel "Speichern unter" als
// "CSV (Trennzeichen-getrennt)" sichern. Die Spalten werden an ihren Überschriften erkannt
// und lassen sich vor der Übernahme von Hand zuordnen.

import type { Baustelle, Kontakt } from './types';

export type Feld = 'nummer' | 'name' | 'kunde' | 'strasse' | 'plz' | 'ort' | 'telefon' | 'objektStrasse' | 'objektPlz' | 'objektOrt';

export const FELDER: { feld: Feld; text: string }[] = [
  { feld: 'nummer', text: 'Projektnummer' },
  { feld: 'name', text: 'Bezeichnung' },
  { feld: 'kunde', text: 'Kunde (Name)' },
  { feld: 'strasse', text: 'Straße Kunde' },
  { feld: 'plz', text: 'PLZ Kunde' },
  { feld: 'ort', text: 'Ort Kunde' },
  { feld: 'telefon', text: 'Telefon Kunde' },
  { feld: 'objektStrasse', text: 'Straße Objekt' },
  { feld: 'objektPlz', text: 'PLZ Objekt' },
  { feld: 'objektOrt', text: 'Ort Objekt' }
];

export type Zuordnung = Partial<Record<Feld, number>>; // Feld -> Spaltennummer

// CSV mit Semikolon oder Komma, Anführungszeichen und Zeilenumbrüchen in Feldern
export function csvLesen(text: string): string[][] {
  const ohneBom = text.replace(/^﻿/, '');
  const ersteZeile = ohneBom.split(/\r?\n/, 1)[0] ?? '';
  const trenner = (ersteZeile.match(/;/g)?.length ?? 0) >= (ersteZeile.match(/,/g)?.length ?? 0) ? ';' : ',';
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let inZitat = false;
  for (let i = 0; i < ohneBom.length; i++) {
    const z = ohneBom[i];
    if (inZitat) {
      if (z === '"' && ohneBom[i + 1] === '"') {
        feld += '"';
        i++;
      } else if (z === '"') inZitat = false;
      else feld += z;
    } else if (z === '"') inZitat = true;
    else if (z === trenner) {
      zeile.push(feld);
      feld = '';
    } else if (z === '\n' || z === '\r') {
      if (z === '\r' && ohneBom[i + 1] === '\n') i++;
      zeile.push(feld);
      if (zeile.some((f) => f.trim())) zeilen.push(zeile);
      zeile = [];
      feld = '';
    } else feld += z;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim())) zeilen.push(zeile);
  return zeilen.map((r) => r.map((f) => f.trim()));
}

const norm = (s: string) => s.toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');

// Errät die Zuordnung aus den Überschriften
export function zuordnungRaten(kopf: string[]): Zuordnung {
  const z: Zuordnung = {};
  const n = kopf.map(norm);
  const finde = (pruef: (s: string) => boolean, belegt: Set<number>) => {
    const i = n.findIndex((s, idx) => !belegt.has(idx) && pruef(s));
    return i >= 0 ? i : undefined;
  };
  const belegt = new Set<number>();
  const setze = (feld: Feld, pruef: (s: string) => boolean) => {
    const i = finde(pruef, belegt);
    if (i !== undefined) {
      z[feld] = i;
      belegt.add(i);
    }
  };
  // Objektadresse zuerst, damit "Straße" nicht bei der Kundenadresse landet
  setze('objektStrasse', (s) => s.includes('objekt') && (s.includes('strasse') || s.includes('str')));
  setze('objektPlz', (s) => s.includes('objekt') && s.includes('plz'));
  setze('objektOrt', (s) => s.includes('objekt') && s.includes('ort') && !s.includes('strasse'));
  setze('nummer', (s) => s === 'projekt' || s.includes('projektnr') || s.includes('projektnummer') || s === 'nummer' || s === 'nr' || s === 'kennung');
  setze('name', (s) => s.includes('bezeichnung') || s.includes('projektname') || s === 'projekt' || s === 'name1projekt');
  setze('kunde', (s) => s.includes('kunde') || s === 'name' || s.includes('nachname') || s === 'name1');
  setze('strasse', (s) => s.includes('strasse') || s === 'str');
  setze('plz', (s) => s === 'plz' || s.includes('postleitzahl') || s.endsWith('plz'));
  setze('ort', (s) => s === 'ort' || s.endsWith('ort') || s.includes('stadt'));
  setze('telefon', (s) => s.includes('telefon') || s.startsWith('tel') || s.includes('mobil'));
  return z;
}

// WinWorker verliert bei Excel-Umwegen gern die führende Null: "1619" -> "01619"
export function plzBereinigen(plz: string): string {
  const ziffern = plz.replace(/\D/g, '');
  return ziffern.length === 4 ? '0' + ziffern : ziffern;
}

// Unvollständige Nummern wie "03525 /" oder "-3525" verwerfen
export function telefonBereinigen(tel: string): string {
  const t = tel.replace(/\s*\/\s*$/, '').trim();
  return t.replace(/\D/g, '').length >= 7 ? t : '';
}

export interface ImportZeile {
  baustelle: Baustelle;
  kontakt: Kontakt | null;
}

export function zeilenUmwandeln(zeilen: string[][], z: Zuordnung, neueId: () => string): ImportZeile[] {
  const wert = (r: string[], f: Feld) => (z[f] !== undefined ? (r[z[f]!] ?? '').trim() : '');
  return zeilen
    .filter((r) => wert(r, 'name') || wert(r, 'nummer'))
    .map((r) => {
      const objekt = wert(r, 'objektStrasse');
      const kunde = wert(r, 'kunde');
      const nummer = wert(r, 'nummer').replace(/^\[|\]$/g, '');
      const baustelle: Baustelle = {
        id: neueId(),
        name: wert(r, 'name') || `Projekt ${nummer}`,
        kunde,
        strasse: objekt || wert(r, 'strasse'),
        plz: plzBereinigen(objekt ? wert(r, 'objektPlz') : wert(r, 'plz')),
        ort: objekt ? wert(r, 'objektOrt') : wert(r, 'ort'),
        zugang: '',
        arbeitsbeginn: '',
        leistung: '',
        bewohnt: false,
        denkmalschutz: false,
        geruest: false,
        notizen: '',
        status: 'geplant',
        abgeschlossenAm: null,
        winworkerNr: nummer
      };
      const tel = telefonBereinigen(wert(r, 'telefon'));
      const kontakt: Kontakt | null =
        kunde || tel ? { id: neueId(), baustelleId: baustelle.id, name: kunde || 'Kunde', rolle: 'Kunde', telefon: tel } : null;
      return { baustelle, kontakt };
    });
}
