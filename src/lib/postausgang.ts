// Postausgang: Was ohne Netz gespeichert wird, wartet hier und wird in der richtigen Reihenfolge
// nachgeschickt, sobald wieder Netz da ist. Dateien werden vor dem Datensatz hochgeladen,
// der auf sie verweist. Jeder Datensatz hat seine Nummer schon auf dem Handy bekommen,
// ein doppeltes Senden überschreibt also nur sich selbst.

import { istNetzfehler, type Datenquelle } from './datenquelle';
import { entfernen, lesen, schreiben } from './speicher';
import type { TabellenName } from './types';

// ab: frühester Sendezeitpunkt (ms). So lässt sich eine Meldung ein paar Sekunden lang zurücknehmen,
// ohne dass sie verloren geht, wenn die App in dieser Zeit geschlossen wird.
export type Vorgang =
  | { nr: number; ab?: number; art: 'speichern'; tabelle: TabellenName; zeile: { id: string } }
  | { nr: number; ab?: number; art: 'loeschen'; tabelle: TabellenName; id: string }
  | { nr: number; ab?: number; art: 'datei'; pfad: string };

export interface Fehlschlag {
  vorgang: Vorgang;
  meldung: string;
}

const LISTE = 'postausgang';
const FEHLER = 'postausgang-fehler';
export const dateiSchluessel = (pfad: string) => `datei:${pfad}`;

let kette: Promise<unknown> = Promise.resolve();
// Alle Zugriffe nacheinander, damit sich Einreihen und Senden nicht überschneiden
function nacheinander<T>(f: () => Promise<T>): Promise<T> {
  const weiter = kette.then(f, f);
  kette = weiter.catch(() => undefined);
  return weiter;
}

export async function wartende(): Promise<Vorgang[]> {
  return (await lesen<Vorgang[]>(LISTE)) ?? [];
}

export async function fehlschlaege(): Promise<Fehlschlag[]> {
  return (await lesen<Fehlschlag[]>(FEHLER)) ?? [];
}

export async function fehlschlaegeLeeren(): Promise<void> {
  await entfernen(FEHLER);
}

type OhneNr<T> = T extends unknown ? Omit<T, 'nr'> : never;

export function einreihen(v: OhneNr<Vorgang>, datei?: Blob): Promise<number> {
  return nacheinander(async () => {
    if (v.art === 'datei' && datei) await schreiben(dateiSchluessel(v.pfad), datei);
    const liste = await wartende();
    const nr = (liste.at(-1)?.nr ?? 0) + 1;
    await schreiben(LISTE, [...liste, { ...v, nr } as Vorgang]);
    return nr;
  });
}

// Nimmt einen noch nicht gesendeten Vorgang zurück. Liefert false, wenn er schon unterwegs war.
export function zurueckholen(nr: number): Promise<boolean> {
  return nacheinander(async () => {
    const liste = await wartende();
    if (!liste.some((v) => v.nr === nr)) return false;
    await schreiben(LISTE, liste.filter((v) => v.nr !== nr));
    return true;
  });
}

// Schickt alles Wartende. Bricht beim ersten Netzfehler ab (später erneut versuchen).
// Lehnt der Server einen Vorgang ab (zum Beispiel fehlende Rechte), wird er beiseitegelegt,
// damit er die übrigen nicht blockiert.
export function senden(quelle: Datenquelle): Promise<{ gesendet: number; offen: number; netzfehler: boolean }> {
  return nacheinander(async () => {
    let gesendet = 0;
    let netzfehler = false;
    for (;;) {
      const liste = await wartende();
      const v = liste[0];
      if (!v || (v.ab && v.ab > Date.now())) break;
      try {
        if (v.art === 'speichern') await quelle.speichern(v.tabelle, v.zeile as never);
        else if (v.art === 'loeschen') await quelle.loeschen(v.tabelle, v.id);
        else {
          const blob = await lesen<Blob>(dateiSchluessel(v.pfad));
          if (blob) await quelle.dateiHochladen(v.pfad, blob);
        }
        gesendet++;
      } catch (e) {
        if (istNetzfehler(e)) {
          netzfehler = true;
          break;
        }
        const alte = await fehlschlaege();
        await schreiben(FEHLER, [...alte, { vorgang: v, meldung: e instanceof Error ? e.message : String(e) }]);
      }
      const aktuell = await wartende();
      await schreiben(LISTE, aktuell.filter((x) => x.nr !== v.nr));
    }
    return { gesendet, offen: (await wartende()).length, netzfehler };
  });
}
