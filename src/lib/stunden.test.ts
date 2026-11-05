import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { excelDatei, exportZeilen, nettoMin, pauseLautVertrag, tagPruefen, vorschlag, zeilenAusZettel } from './stunden';
import { STANDARD_EINSTELLUNGEN, type Einsatz, type Person, type Stunde } from './types';

const paula: Person = { id: 'p', name: 'Paula Krüger', email: '', telefon: '', rolle: 'mitarbeiter', imPlan: true, azubi: false, jugendlichBis: null, aktivBis: null, winworkerNr: '' };
const mia: Person = { ...paula, id: 'm', name: 'Mia', azubi: true, jugendlichBis: '2028-01-01' };
const einsatz = (datum: string, beginn = '06:30', ende = '16:00'): Einsatz => ({ id: `e-${datum}`, personId: 'p', baustelleId: 'b1', datum, beginn, ende, notiz: '' });
const stunde = (datum: string, beginn: string, ende: string, pauseMin = 60, personId = 'p'): Stunde => ({
  id: `${personId}-${datum}-${beginn}`, personId, datum, baustelleId: 'b1', beginn, ende, pauseMin, notiz: '', status: 'offen', freigegebenAm: null, exportiertAm: null, erstelltAm: ''
});

describe('Stundenzettel', () => {
  it('Pause laut Vertrag: Mo bis Do 60, Fr 30', () => {
    expect(pauseLautVertrag('2026-10-27')).toBe(60);
    expect(pauseLautVertrag('2026-10-30')).toBe(30);
  });

  it('Vorschlag kommt aus dem Plan', () => {
    const z = vorschlag('p', '2026-10-27', [einsatz('2026-10-27')], STANDARD_EINSTELLUNGEN);
    expect(z.abschnitte).toEqual([{ id: null, baustelleId: 'b1', beginn: '06:30', ende: '16:00' }]);
    expect(nettoMin(z)).toBe(510);
    const frei = vorschlag('p', '2026-10-30', [], STANDARD_EINSTELLUNGEN);
    expect(frei.abschnitte[0]).toMatchObject({ baustelleId: null, ende: '12:00' });
    expect(frei.pauseMin).toBe(30);
  });

  it('Plantag ohne Abweichung ist in Ordnung', () => {
    const z = vorschlag('p', '2026-10-27', [einsatz('2026-10-27')], STANDARD_EINSTELLUNGEN);
    expect(tagPruefen(paula, '2026-10-27', z, [], [einsatz('2026-10-27')])).toEqual({ fehler: [], abweichung: [] });
  });

  it('warnt bei zu kurzer Pause, über 10 Stunden und zu wenig Ruhe', () => {
    const z = { abschnitte: [{ id: null, baustelleId: 'b1', beginn: '05:00', ende: '16:30' }], pauseMin: 30 };
    const gestern = [stunde('2026-10-26', '06:30', '20:00')];
    const { fehler } = tagPruefen(paula, '2026-10-27', z, gestern, []);
    expect(fehler).toContain('Laut Arbeitsvertrag sind 60 Minuten Pause vorgeschrieben.');
    expect(fehler).toContain('Mehr als 10 Stunden. Das erlaubt das Arbeitszeitgesetz nicht.');
    expect(fehler.some((f) => f.startsWith('Nur 9:00 Stunden Ruhe'))).toBe(true);
  });

  it('Jugendschutz: höchstens 8,5 Stunden am Tag und 40 in der Woche', () => {
    const lang = { abschnitte: [{ id: null, baustelleId: 'b1', beginn: '06:30', ende: '16:30' }], pauseMin: 60 };
    expect(tagPruefen(mia, '2026-10-27', lang, [], []).fehler.some((f) => f.startsWith('Jugendliche: 9 Stunden'))).toBe(true);
    const woche = ['2026-10-26', '2026-10-28', '2026-10-29', '2026-10-30'].map((d) => stunde(d, '06:00', '15:30', 60, 'm'));
    const normal = { abschnitte: [{ id: null, baustelleId: 'b1', beginn: '06:30', ende: '15:00' }], pauseMin: 60 };
    expect(tagPruefen(mia, '2026-10-27', normal, woche, []).fehler.some((f) => f.includes('in dieser Woche'))).toBe(true);
  });

  it('zwei Baustellen: Pause steht bei der ersten Zeile, entfernte Zeilen werden gelöscht', () => {
    const vorher = [stunde('2026-10-27', '06:30', '16:00')];
    let n = 0;
    const { speichern, loeschen } = zeilenAusZettel(
      { abschnitte: [{ id: null, baustelleId: 'b2', beginn: '12:00', ende: '16:00' }, { id: null, baustelleId: 'b1', beginn: '06:30', ende: '12:00' }], pauseMin: 60 },
      'p', '2026-10-27', vorher, () => `neu${++n}`
    );
    expect(speichern.map((s) => [s.baustelleId, s.beginn, s.pauseMin])).toEqual([['b1', '06:30', 60], ['b2', '12:00', 0]]);
    expect(loeschen).toEqual([vorher[0].id]);
  });

  it('Excel-Datei enthält Kopfzeile und Werte', async () => {
    const zeilen = exportZeilen([stunde('2026-10-27', '06:30', '16:00')], [{ ...paula, winworkerNr: '12' }], [{ id: 'b1', name: 'Fassade <Lindenweg>', winworkerNr: '2610101' } as never]);
    expect(zeilen[1].slice(0, 4)).toEqual([12, 2610101, { zeitpunkt: 46322 + 6.5 / 24 }, 8.5]);
    expect(zeilen[1].slice(9)).toEqual(['Paula Krüger', 'Fassade <Lindenweg>', '06:30 bis 16:00', 60, '']);
    const blob = await excelDatei(zeilen);
    const dateien = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const blatt = strFromU8(dateien['xl/worksheets/sheet1.xml']);
    expect(blatt).toContain('<v>8.5</v>');
    expect(blatt).toContain('s="2"');
    expect(blatt).toContain('Fassade &lt;Lindenweg&gt;');
    expect(Object.keys(dateien)).toContain('[Content_Types].xml');
  });
});
