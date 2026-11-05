import { describe, expect, it } from 'vitest';
import { csvLesen, plzBereinigen, telefonBereinigen, zeilenUmwandeln, zuordnungRaten } from './winworker';

// Ausgedachte Beispieldaten im Aufbau eines WinWorker-Exports
const CSV = `﻿Projektnummer;Bezeichnung;Kunde;Straße;PLZ;Ort;Telefon;Objekt Straße;Objekt PLZ;Objekt Ort
2509101;"Fassade streichen - Muster";Max Muster;Hauptstraße 1;1587;Riesa;03525 /;;;
2509102;Treppenhaus;"Wohnbau ""Elbe"" GmbH";Am Markt 2;01589;Riesa;0351 1234567;Elbstraße 7;01591;Riesa
;;;;;;;;;
`;

describe('WinWorker-Import', () => {
  it('liest CSV mit Semikolon, Anführungszeichen und BOM', () => {
    const z = csvLesen(CSV);
    expect(z).toHaveLength(3);
    expect(z[2][2]).toBe('Wohnbau "Elbe" GmbH');
  });

  it('erkennt die Spalten an den Überschriften', () => {
    const kopf = csvLesen(CSV)[0];
    expect(zuordnungRaten(kopf)).toEqual({
      nummer: 0, name: 1, kunde: 2, strasse: 3, plz: 4, ort: 5, telefon: 6, objektStrasse: 7, objektPlz: 8, objektOrt: 9
    });
  });

  it('nimmt die Objektadresse, wenn vorhanden, und repariert PLZ und Telefon', () => {
    const [kopf, ...daten] = csvLesen(CSV);
    let n = 0;
    const r = zeilenUmwandeln(daten, zuordnungRaten(kopf), () => `id${n++}`);
    expect(r[0].baustelle).toMatchObject({ name: 'Fassade streichen - Muster', strasse: 'Hauptstraße 1', plz: '01587', winworkerNr: '2509101' });
    expect(r[0].kontakt).toMatchObject({ name: 'Max Muster', telefon: '' });
    expect(r[1].baustelle).toMatchObject({ strasse: 'Elbstraße 7', plz: '01591' });
    expect(r[1].kontakt?.telefon).toBe('0351 1234567');
  });

  it('bereinigt einzelne Werte', () => {
    expect(plzBereinigen('1619')).toBe('01619');
    expect(plzBereinigen('01589')).toBe('01589');
    expect(telefonBereinigen('-3525')).toBe('');
    expect(telefonBereinigen('0176 76852780')).toBe('0176 76852780');
  });
});
