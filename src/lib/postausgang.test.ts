import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Datenquelle } from './datenquelle';
import { einreihen, fehlschlaege, fehlschlaegeLeeren, senden, wartende, zurueckholen } from './postausgang';
import { schreiben } from './speicher';

function testQuelle(verhalten: { netzWeg?: boolean; ablehnen?: string } = {}) {
  const log: string[] = [];
  const q = {
    modus: 'online',
    async speichern(tabelle: string, zeile: { id: string }) {
      if (verhalten.netzWeg) throw new TypeError('Failed to fetch');
      if (verhalten.ablehnen === zeile.id) throw new Error('permission denied');
      log.push(`speichern ${tabelle} ${zeile.id}`);
      return zeile;
    },
    async loeschen(tabelle: string, id: string) {
      log.push(`loeschen ${tabelle} ${id}`);
    },
    async dateiHochladen(pfad: string, datei: Blob) {
      if (verhalten.netzWeg) throw new TypeError('Failed to fetch');
      log.push(`datei ${pfad} ${datei.size}`);
    }
  } as unknown as Datenquelle;
  return { q, log, verhalten };
}

describe('Postausgang', () => {
  beforeEach(async () => {
    await schreiben('postausgang', []);
    await fehlschlaegeLeeren();
  });

  it('sendet in der Reihenfolge des Einreihens, Datei vor Datensatz', async () => {
    await einreihen({ art: 'datei', pfad: 'lieferschein/1/s1.jpg' }, new Blob(['abc']));
    await einreihen({ art: 'speichern', tabelle: 'lieferscheine', zeile: { id: 'l1' } });
    await einreihen({ art: 'loeschen', tabelle: 'meldungen', id: 'm9' });
    const { q, log } = testQuelle();
    const r = await senden(q);
    expect(log).toEqual(['datei lieferschein/1/s1.jpg 3', 'speichern lieferscheine l1', 'loeschen meldungen m9']);
    expect(r).toEqual({ gesendet: 3, offen: 0, netzfehler: false });
  });

  it('behält alles, solange kein Netz da ist, und sendet später', async () => {
    await einreihen({ art: 'speichern', tabelle: 'meldungen', zeile: { id: 'm1' } });
    const t = testQuelle({ netzWeg: true });
    expect(await senden(t.q)).toEqual({ gesendet: 0, offen: 1, netzfehler: true });
    t.verhalten.netzWeg = false;
    expect(await senden(t.q)).toEqual({ gesendet: 1, offen: 0, netzfehler: false });
    expect(t.log).toEqual(['speichern meldungen m1']);
  });

  it('legt abgelehnte Vorgänge beiseite und sendet den Rest', async () => {
    await einreihen({ art: 'speichern', tabelle: 'meldungen', zeile: { id: 'verboten' } });
    await einreihen({ art: 'speichern', tabelle: 'meldungen', zeile: { id: 'ok' } });
    const { q, log } = testQuelle({ ablehnen: 'verboten' });
    await senden(q);
    expect(log).toEqual(['speichern meldungen ok']);
    expect(await wartende()).toEqual([]);
    expect((await fehlschlaege()).map((f) => f.meldung)).toEqual(['permission denied']);
  });

  it('hält zurücknehmbare Vorgänge kurz zurück und lässt sie zurückholen', async () => {
    const nr = await einreihen({ art: 'speichern', tabelle: 'krankmeldungen', zeile: { id: 'k1' }, ab: Date.now() + 60_000 });
    const { q, log } = testQuelle();
    expect(await senden(q)).toEqual({ gesendet: 0, offen: 1, netzfehler: false });
    expect(await zurueckholen(nr)).toBe(true);
    expect(await wartende()).toEqual([]);
    expect(log).toEqual([]);
  });
});
