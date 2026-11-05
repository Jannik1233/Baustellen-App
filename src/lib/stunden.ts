// Stundenzettel: Vorschlag aus dem Plan, Prüfungen und Excel-Datei für WinWorker.

import { parseDatum } from './arbeitstage';
import { abwesenheitAm, feiertag, fmtStunden, istJugendlich, montagDerWoche, plusTage, standardZeiten, tageDerWoche } from './regeln';
import type { Abwesenheit, Baustelle, Einsatz, Einstellungen, Person, Stunde } from './types';

export const minuten = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const alsUhrzeit = (min: number) => {
  const m = Math.min(Math.max(min, 0), 24 * 60 - 1);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// 510 -> "8:30"
export const alsDauer = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;

// Pause laut Arbeitsvertrag: Montag bis Donnerstag 60 Minuten, Freitag 30 Minuten
export const pauseLautVertrag = (datum: string) => (parseDatum(datum).getDay() === 5 ? 30 : 60);

// Ein Abschnitt des Tages, so wie ihn die Karte bearbeitet
export interface Abschnitt {
  id: string | null; // null = neu
  baustelleId: string | null;
  beginn: string;
  ende: string;
}

export interface Tageszettel {
  abschnitte: Abschnitt[];
  pauseMin: number;
}

export const stundenAm = (stunden: Stunde[], personId: string, datum: string) =>
  stunden.filter((s) => s.personId === personId && s.datum === datum).sort((a, b) => a.beginn.localeCompare(b.beginn));

// Vorschlag aus dem Wochenplan, sonst aus der Standard-Arbeitszeit
export function vorschlag(personId: string, datum: string, einsaetze: Einsatz[], e: Einstellungen): Tageszettel {
  const geplant = einsaetze.filter((x) => x.personId === personId && x.datum === datum).sort((a, b) => a.beginn.localeCompare(b.beginn));
  if (geplant.length)
    return { abschnitte: geplant.map((x) => ({ id: null, baustelleId: x.baustelleId, beginn: x.beginn, ende: x.ende })), pauseMin: pauseLautVertrag(datum) };
  const z = standardZeiten(datum, e);
  return { abschnitte: [{ id: null, baustelleId: null, beginn: z.beginn, ende: z.ende }], pauseMin: pauseLautVertrag(datum) };
}

export function ausStunden(eintraege: Stunde[]): Tageszettel {
  return {
    abschnitte: eintraege.map((s) => ({ id: s.id, baustelleId: s.baustelleId, beginn: s.beginn, ende: s.ende })),
    pauseMin: eintraege.reduce((n, s) => n + s.pauseMin, 0)
  };
}

export const bruttoMin = (z: Tageszettel) => z.abschnitte.reduce((n, a) => n + Math.max(0, minuten(a.ende) - minuten(a.beginn)), 0);
export const nettoMin = (z: Tageszettel) => Math.max(0, bruttoMin(z) - z.pauseMin);
export const stundeNettoMin = (s: Stunde) => Math.max(0, minuten(s.ende) - minuten(s.beginn) - s.pauseMin);

// Muss jemand an diesem Tag Stunden aufschreiben? Arbeitstag, nicht abwesend, und eingeplant oder im Plan geführt.
export function sollEintragen(p: Person, datum: string, einsaetze: Einsatz[], abwesenheiten: Abwesenheit[]): boolean {
  if (einsaetze.some((e) => e.personId === p.id && e.datum === datum)) return true;
  const wt = parseDatum(datum).getDay();
  if (!p.imPlan || wt === 0 || wt === 6 || feiertag(datum)) return false;
  return !abwesenheitAm(p.id, datum, abwesenheiten);
}

// Prüft einen Tag. Warnt nur, verbietet nichts.
// Arbeitszeitgesetz §§ 3, 4, 5 und Jugendarbeitsschutzgesetz §§ 8, 11 vereinfacht, Pause zusätzlich laut Arbeitsvertrag.
export function tagPruefen(
  p: Person,
  datum: string,
  z: Tageszettel,
  alle: Stunde[],
  einsaetze: Einsatz[]
): { fehler: string[]; abweichung: string[] } {
  const fehler: string[] = [];
  const abweichung: string[] = [];
  const netto = nettoMin(z);
  for (const a of z.abschnitte) if (minuten(a.ende) <= minuten(a.beginn)) fehler.push('Das Ende liegt vor dem Beginn.');
  const sortiert = [...z.abschnitte].sort((a, b) => a.beginn.localeCompare(b.beginn));
  for (let i = 1; i < sortiert.length; i++)
    if (minuten(sortiert[i].beginn) < minuten(sortiert[i - 1].ende)) fehler.push('Die Zeiten der Baustellen überschneiden sich.');
  const soll = pauseLautVertrag(datum);
  if (z.pauseMin < soll && netto > 0) fehler.push(`Laut Arbeitsvertrag sind ${soll} Minuten Pause vorgeschrieben.`);
  if (netto > 600) fehler.push('Mehr als 10 Stunden. Das erlaubt das Arbeitszeitgesetz nicht.');
  if (istJugendlich(p, datum)) {
    if (netto > 510) fehler.push(`Jugendliche: ${fmtStunden(netto / 60)} Stunden, erlaubt sind höchstens 8,5.`);
    const woche = tageDerWoche(montagDerWoche(datum), 7);
    const wochenMin =
      alle.filter((s) => s.personId === p.id && woche.includes(s.datum) && s.datum !== datum).reduce((n, s) => n + stundeNettoMin(s), 0) + netto;
    if (wochenMin > 2400) fehler.push(`Jugendliche: ${fmtStunden(wochenMin / 60)} Stunden in dieser Woche, erlaubt sind 40.`);
    if (sortiert.length && (minuten(sortiert[0].beginn) < 360 || minuten(sortiert[sortiert.length - 1].ende) > 1200))
      fehler.push('Jugendliche: Arbeit nur zwischen 6 und 20 Uhr.');
  }
  // Ruhezeit zum Vortag: mindestens 11 Stunden
  const vortag = stundenAm(alle, p.id, plusTage(datum, -1));
  if (vortag.length && sortiert.length) {
    const ruhe = 24 * 60 - minuten(vortag[vortag.length - 1].ende) + minuten(sortiert[0].beginn);
    if (ruhe < 660) fehler.push(`Nur ${alsDauer(ruhe)} Stunden Ruhe seit gestern, vorgeschrieben sind 11.`);
  }
  const geplant = einsaetze.filter((e) => e.personId === p.id && e.datum === datum);
  if (geplant.length) {
    const gleich =
      geplant.length === z.abschnitte.length &&
      [...geplant].sort((a, b) => a.beginn.localeCompare(b.beginn)).every((e, i) => e.baustelleId === sortiert[i]?.baustelleId && e.beginn === sortiert[i].beginn && e.ende === sortiert[i].ende);
    if (!gleich) abweichung.push('Weicht vom Wochenplan ab.');
  } else if (netto > 0) abweichung.push('An diesem Tag war nichts geplant.');
  return { fehler: [...new Set(fehler)], abweichung };
}

// Aus dem bearbeiteten Tageszettel die zu speichernden und zu löschenden Zeilen machen
export function zeilenAusZettel(
  z: Tageszettel,
  personId: string,
  datum: string,
  vorher: Stunde[],
  neueId: () => string
): { speichern: Stunde[]; loeschen: string[] } {
  const jetzt = new Date().toISOString();
  const sortiert = [...z.abschnitte].sort((a, b) => a.beginn.localeCompare(b.beginn));
  const speichern = sortiert.map((a, i): Stunde => {
    const alt = vorher.find((s) => s.id === a.id);
    return {
      id: a.id ?? neueId(),
      personId,
      datum,
      baustelleId: a.baustelleId,
      beginn: a.beginn,
      ende: a.ende,
      pauseMin: i === 0 ? z.pauseMin : 0,
      notiz: alt?.notiz ?? '',
      status: 'offen',
      freigegebenAm: null,
      exportiertAm: alt?.exportiertAm ?? null,
      erstelltAm: alt?.erstelltAm ?? jetzt
    };
  });
  const behalten = new Set(speichern.map((s) => s.id));
  return { speichern, loeschen: vorher.filter((s) => !behalten.has(s.id)).map((s) => s.id) };
}

// ---------------------------------------------------------------------------
// Excel-Datei für WinWorker
// ---------------------------------------------------------------------------

// Spalten der Exportdatei. Annahme, bis die WinWorker-Importvorlage vorliegt: dann nur diese Liste anpassen.
// Zeitpunkt als Excel-Seriennummer (Tage seit 30.12.1899), damit WinWorker „Datum und Uhrzeit“ sicher erkennt
export interface Zeitpunkt {
  zeitpunkt: number;
}
export type Zelle = string | number | Zeitpunkt;
export const alsZeitpunkt = (datum: string, hhmm: string): Zeitpunkt => {
  const [j, m, t] = datum.split('-').map(Number);
  return { zeitpunkt: (Date.UTC(j, m - 1, t) - Date.UTC(1899, 11, 30)) / 86400000 + minuten(hhmm) / 1440 };
};
// Reine Ziffern als Zahl ausgeben, sonst als Text
const nummer = (t: string | undefined): string | number => (t && /^\d{1,15}$/.test(t.trim()) ? Number(t.trim()) : (t ?? '').trim());

// Spalten passend zur Konfiguration „Excel Stundenmitschreibungsimport“ in WinWorker:
// A Mitarbeiter (WW-Index), B Projekt (WW-Projekt-Index), C Start (Datum und Uhrzeit), D Dauer in Stunden,
// E Buchungsdatum (WinWorker übernimmt das Datum vom Start), F Leistung, G Stundenlohnart, H Einmalbetrag, I Einmalb.-Lohnart.
// Ab Spalte J folgen Angaben nur zur Kontrolle, die WinWorker nicht einliest.
export const EXPORT_SPALTEN: { titel: string; wert: (s: Stunde, p: Person | undefined, b: Baustelle | undefined) => Zelle }[] = [
  { titel: 'Mitarbeiter', wert: (_s, p) => nummer(p?.winworkerNr) },
  { titel: 'Projekt', wert: (_s, _p, b) => nummer(b?.winworkerNr) },
  { titel: 'Start', wert: (s) => alsZeitpunkt(s.datum, s.beginn) },
  { titel: 'Dauer', wert: (s) => Math.round((stundeNettoMin(s) / 60) * 100) / 100 },
  { titel: 'Buchungsdatum', wert: () => '' },
  { titel: 'Leistung', wert: () => '' },
  { titel: 'Lohnart', wert: () => '' },
  { titel: 'Einmalbetrag', wert: () => '' },
  { titel: 'Einmalb.-Lohnart', wert: () => '' },
  { titel: 'Name', wert: (_s, p) => p?.name ?? '' },
  { titel: 'Baustelle', wert: (_s, _p, b) => b?.name ?? 'Werkstatt / Lager' },
  { titel: 'Zeit', wert: (s) => `${s.beginn} bis ${s.ende}` },
  { titel: 'Pause (Minuten)', wert: (s) => s.pauseMin },
  { titel: 'Notiz', wert: (s) => s.notiz }
];

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function spalteBuchstabe(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Baut eine schlichte .xlsx-Datei (eine Tabelle, erste Zeile fett, Zeitpunkte als Datum mit Uhrzeit) ohne große Zusatzbibliothek
export async function excelDatei(zeilen: Zelle[][], blattname = 'Stunden'): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const zellen = zeilen
    .map((zeile, r) => {
      const c = zeile
        .map((w, i) => {
          const ref = `${spalteBuchstabe(i)}${r + 1}`;
          const stil = r === 0 ? ' s="1"' : '';
          if (w === '') return ''; // leere Zellen weglassen, damit WinWorker sie als leer erkennt
          if (typeof w === 'number') return `<c r="${ref}"${stil}><v>${w}</v></c>`;
          if (typeof w === 'object') return `<c r="${ref}" s="2"><v>${w.zeitpunkt}</v></c>`;
          return `<c r="${ref}" t="inlineStr"${stil}><is><t xml:space="preserve">${xml(w)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${c}</row>`;
    })
    .join('');
  const kopf = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const dateien: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${kopf}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    ),
    '_rels/.rels': strToU8(
      `${kopf}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ),
    'xl/workbook.xml': strToU8(
      `${kopf}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(blattname)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${kopf}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    ),
    'xl/styles.xml': strToU8(
      `${kopf}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `${kopf}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${zellen}</sheetData></worksheet>`
    )
  };
  return new Blob([zipSync(dateien) as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportZeilen(stunden: Stunde[], personen: Person[], baustellen: Baustelle[]): Zelle[][] {
  const sortiert = [...stunden].sort(
    (a, b) => (personen.find((p) => p.id === a.personId)?.name ?? '').localeCompare(personen.find((p) => p.id === b.personId)?.name ?? '') || a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn)
  );
  return [
    EXPORT_SPALTEN.map((s) => s.titel),
    ...sortiert.map((s) => {
      const p = personen.find((x) => x.id === s.personId);
      const b = baustellen.find((x) => x.id === s.baustelleId);
      return EXPORT_SPALTEN.map((sp) => sp.wert(s, p, b));
    })
  ];
}
