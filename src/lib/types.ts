// Datenmodell der App. In der Datenbank heißen die Spalten gleich, nur in snake_case.
// Datumswerte als 'JJJJ-MM-TT', Zeitpunkte als ISO-Zeitstempel, Uhrzeiten als 'HH:MM'.

export type Rolle = 'admin' | 'buero' | 'mitarbeiter';

export interface Person {
  id: string;
  name: string;
  email: string;
  telefon: string;
  rolle: Rolle;
  imPlan: boolean; // erscheint als Zeile im Wochenplan
  azubi: boolean;
  // Tag des 18. Geburtstags. Statt des Geburtsdatums gespeichert (Datensparsamkeit).
  jugendlichBis: string | null;
  aktivBis: string | null; // danach ist der Zugang gesperrt
  winworkerNr: string; // Mitarbeiter-Index in WinWorker, für den Stunden-Export
}

export type BaustellenStatus = 'geplant' | 'laeuft' | 'abgeschlossen';

export interface Baustelle {
  id: string;
  name: string;
  kunde: string;
  strasse: string;
  plz: string;
  ort: string;
  zugang: string; // Zugang, Schlüssel, Parken
  arbeitsbeginn: string; // 'HH:MM', Vorschlag für neue Einsätze
  leistung: string; // Leistungsumfang in Worten
  bewohnt: boolean;
  denkmalschutz: boolean;
  geruest: boolean;
  notizen: string;
  status: BaustellenStatus;
  abgeschlossenAm: string | null;
  winworkerNr: string;
}

export type KontaktRolle = 'Kunde' | 'Bauleitung' | 'Hausmeister' | 'Sonstige';

export interface Kontakt {
  id: string;
  baustelleId: string;
  name: string;
  rolle: KontaktRolle;
  telefon: string;
}

export interface Material {
  id: string;
  baustelleId: string;
  bezeichnung: string;
  farbton: string;
  menge: string; // Freitext, z. B. "3 x 12,5 l"
}

export type FotoArt = 'ist' | 'fortschritt' | 'mangel';

export interface Foto {
  id: string;
  baustelleId: string;
  art: FotoArt;
  pfad: string;
  notiz: string;
  erstelltVon: string;
  erstelltAm: string;
}

export interface Einsatz {
  id: string;
  personId: string;
  baustelleId: string;
  datum: string;
  beginn: string;
  ende: string;
  notiz: string;
}

// Ein veröffentlichter Plan für eine Woche. Löst eine Benachrichtigung je betroffener Person aus.
export interface Planfassung {
  id: string;
  woche: string; // Montag der Woche
  veroeffentlichtAm: string;
  hinweis: string;
}

export interface Bestaetigung {
  id: string;
  planfassungId: string;
  personId: string;
  bestaetigtAm: string | null;
  erinnertAm: string | null;
}

export type AbwesenheitArt = 'urlaub' | 'abwesend' | 'berufsschule' | 'sonstiges';
export type AntragStatus = 'beantragt' | 'genehmigt' | 'abgelehnt';

export interface Abwesenheit {
  id: string;
  personId: string;
  art: AbwesenheitArt;
  von: string;
  bis: string;
  status: AntragStatus;
  notiz: string; // bei Ablehnung der Grund, sonst frei. Nie ein Krankheitsgrund.
  erstelltAm: string;
}

export interface Urlaubskonto {
  id: string;
  personId: string;
  jahr: number;
  anspruch: number;
  genommen: number; // laut WinWorker
  standVom: string;
}

// Nur die Tatsache, kein Grund, kein Attest. Erzeugt eine Abwesenheit "abwesend".
export interface Krankmeldung {
  id: string;
  personId: string;
  ab: string;
  bisVoraussichtlich: string | null;
  gemeldetAm: string;
}

export type MeldungArt = 'maschine' | 'material';
export type MeldungStatus = 'offen' | 'in_bearbeitung' | 'erledigt';

export interface Meldung {
  id: string;
  art: MeldungArt;
  melderId: string;
  baustelleId: string | null;
  maschineId: string | null;
  arbeitSteht: boolean;
  material: string;
  menge: string;
  benoetigtBis: string | null;
  beschreibung: string;
  fotoPfad: string | null;
  status: MeldungStatus;
  erstelltAm: string;
  erledigtAm: string | null;
}

export type LieferscheinStatus = 'offen' | 'geprueft' | 'abgelegt';

export interface Lieferschein {
  id: string;
  baustelleId: string | null;
  datum: string;
  lieferant: string;
  seiten: string[]; // Dateipfade der Seitenbilder
  status: LieferscheinStatus;
  erfasstVon: string;
  erfasstAm: string;
}

export type MaschinenZustand = 'ok' | 'defekt' | 'reparatur';

export interface Maschine {
  id: string;
  bezeichnung: string;
  inventarNr: string;
  standortBaustelleId: string | null; // leer = im Lager
  zustand: MaschinenZustand;
  notiz: string;
}

export interface Pruefung {
  id: string;
  maschineId: string;
  art: string; // z. B. "DGUV V3"
  intervallMonate: number;
  zuletzt: string | null;
}

export type DokumentKategorie = 'plan' | 'lv' | 'farbkarte' | 'sicherheitsdatenblatt' | 'betriebsanweisung' | 'unterweisung' | 'sonstiges';

export interface Dokument {
  id: string;
  baustelleId: string | null; // leer = allgemein
  kategorie: DokumentKategorie;
  titel: string;
  pfad: string;
  dateiname: string;
  offline: boolean; // auf allen Handys vorhalten
  hochgeladenAm: string;
}

// Arbeitszeit eines Tages auf einer Baustelle. Zwei Baustellen am Tag sind zwei Zeilen, die Pause steht bei der ersten.
export type StundenStatus = 'offen' | 'freigegeben';

export interface Stunde {
  id: string;
  personId: string;
  datum: string;
  baustelleId: string | null; // leer = Werkstatt oder Lager
  beginn: string;
  ende: string;
  pauseMin: number;
  notiz: string;
  status: StundenStatus; // freigegeben setzt nur der Admin, danach nicht mehr änderbar
  freigegebenAm: string | null;
  exportiertAm: string | null; // zuletzt in eine Excel-Datei für WinWorker übernommen
  erstelltAm: string;
}

export interface Einstellungen {
  id: string;
  beginn: string;
  ende: string;
  endeFreitag: string;
  pushVon: string;
  pushBis: string;
}

export interface Tabellen {
  personen: Person;
  baustellen: Baustelle;
  kontakte: Kontakt;
  materialien: Material;
  fotos: Foto;
  einsaetze: Einsatz;
  planfassungen: Planfassung;
  bestaetigungen: Bestaetigung;
  abwesenheiten: Abwesenheit;
  urlaubskonten: Urlaubskonto;
  krankmeldungen: Krankmeldung;
  meldungen: Meldung;
  lieferscheine: Lieferschein;
  maschinen: Maschine;
  pruefungen: Pruefung;
  dokumente: Dokument;
  einstellungen: Einstellungen;
  stunden: Stunde;
}

export type TabellenName = keyof Tabellen;

export const TABELLEN: TabellenName[] = [
  'personen', 'baustellen', 'kontakte', 'materialien', 'fotos', 'einsaetze', 'planfassungen', 'bestaetigungen',
  'abwesenheiten', 'urlaubskonten', 'krankmeldungen', 'meldungen', 'lieferscheine', 'maschinen', 'pruefungen',
  'dokumente', 'einstellungen', 'stunden'
];

export type Bestand = { [K in TabellenName]: Tabellen[K][] };

export function leererBestand(): Bestand {
  return Object.fromEntries(TABELLEN.map((t) => [t, []])) as unknown as Bestand;
}

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  id: 'standard',
  beginn: '06:30',
  ende: '16:00',
  endeFreitag: '12:00',
  pushVon: '06:30',
  pushBis: '18:00'
};
