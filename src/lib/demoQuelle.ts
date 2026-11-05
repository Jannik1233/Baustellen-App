import { neueId, type Datenquelle } from './datenquelle';
import { demoDaten } from './demoDaten';
import { lesen as idbLesen, schreiben as idbSchreiben } from './speicher';
import type { Abwesenheit, Bestaetigung, Bestand, Einsatz, Krankmeldung, Person, Planfassung, TabellenName } from './types';

// Speichert alles im Browser dieses Geräts. Nur zum Ausprobieren, nicht für den Echtbetrieb.
// Ahmt nach, was im Echtbetrieb die Datenbank selbst erledigt (Krankmeldung erzeugt Abwesenheit).
const SCHLUESSEL = 'fs-demo-daten-v2';

// Alte Testdaten (v1 mit ausgedachten Baustellen) und Planentwürfe einmalig entfernen.
try {
  if (localStorage.getItem('fs-demo-daten-v1') !== null) {
    localStorage.removeItem('fs-demo-daten-v1');
    for (const k of Object.keys(localStorage)) if (k.startsWith('fs-plan-entwurf:')) localStorage.removeItem(k);
  }
} catch {
  // Speicher nicht verfügbar
}
const BENUTZER_SCHLUESSEL = 'fs-demo-benutzer';

function lesen(): Bestand {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (roh) return JSON.parse(roh) as Bestand;
  } catch {
    // ungültiger oder blockierter Speicher: mit Beispieldaten neu beginnen
  }
  const daten = demoDaten();
  schreiben(daten);
  return daten;
}

function schreiben(daten: Bestand) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(daten));
  } catch {
    // Speicher nicht verfügbar, Änderungen gelten nur bis zum Neuladen
  }
}

function zeileSetzen<T extends { id: string }>(liste: T[], zeile: T) {
  const i = liste.findIndex((z) => z.id === zeile.id);
  if (i >= 0) liste[i] = zeile;
  else liste.push(zeile);
}

export function demoAnmelden(personId: string) {
  try {
    localStorage.setItem(BENUTZER_SCHLUESSEL, personId);
  } catch {
    // ignorieren
  }
}

export function demoZuruecksetzen() {
  try {
    localStorage.removeItem(SCHLUESSEL);
    for (const k of Object.keys(localStorage)) if (k.startsWith('fs-plan-entwurf:')) localStorage.removeItem(k);
  } catch {
    // ignorieren
  }
}

export function demoPersonen(): Person[] {
  return lesen().personen;
}

export const demoQuelle: Datenquelle = {
  modus: 'demo',

  async aktuellerBenutzer() {
    try {
      const id = localStorage.getItem(BENUTZER_SCHLUESSEL);
      return lesen().personen.find((p) => p.id === id) ?? null;
    } catch {
      return null;
    }
  },

  async abmelden() {
    try {
      localStorage.removeItem(BENUTZER_SCHLUESSEL);
    } catch {
      // ignorieren
    }
  },

  async laden(tabelle) {
    return (lesen()[tabelle] ?? []) as never;
  },

  async speichern(tabelle, zeile) {
    const daten = lesen();
    zeileSetzen((daten[tabelle] ??= [] as never) as { id: string }[], zeile as { id: string });
    if (tabelle === 'krankmeldungen') {
      const k = zeile as Krankmeldung;
      const abw: Abwesenheit = {
        id: `krank-${k.id}`, personId: k.personId, art: 'abwesend', von: k.ab, bis: k.bisVoraussichtlich ?? k.ab,
        status: 'genehmigt', notiz: '', erstelltAm: k.gemeldetAm
      };
      zeileSetzen(daten.abwesenheiten, abw);
    }
    schreiben(daten);
    return zeile;
  },

  async loeschen(tabelle: TabellenName, id) {
    const daten = lesen();
    daten[tabelle] = ((daten[tabelle] ?? []) as { id: string }[]).filter((z) => z.id !== id) as never;
    schreiben(daten);
  },

  async dateiHochladen(pfad, datei) {
    await idbSchreiben(`demo-datei:${pfad}`, datei);
  },

  async dateiLaden(pfad) {
    const blob = await idbLesen<Blob>(`demo-datei:${pfad}`);
    if (!blob) throw new Error('Datei nicht gefunden.');
    return blob;
  },

  async planVeroeffentlichen(montag, aenderung, hinweis) {
    const daten = lesen();
    const ich = await demoQuelle.aktuellerBenutzer();
    const loeschen = new Set(aenderung.loeschen);
    daten.einsaetze = daten.einsaetze.filter((e) => !loeschen.has(e.id));
    for (const e of aenderung.speichern) zeileSetzen<Einsatz>(daten.einsaetze, e);
    const fassung: Planfassung = { id: neueId(), woche: montag, veroeffentlichtAm: new Date().toISOString(), hinweis };
    daten.planfassungen.push(fassung);
    for (const personId of aenderung.betroffene) {
      const b: Bestaetigung = { id: neueId(), planfassungId: fassung.id, personId, bestaetigtAm: personId === ich?.id ? fassung.veroeffentlichtAm : null, erinnertAm: null };
      daten.bestaetigungen.push(b);
    }
    schreiben(daten);
    return fassung;
  },

  async pushAbonnieren() {
    // Im Demo-Modus gibt es keinen Server, der Benachrichtigungen verschickt
  }
};
