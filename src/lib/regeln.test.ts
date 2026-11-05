import { describe, expect, it } from 'vitest';
import {
  bisNachArbeitstagen, kalenderwoche, montagDerWoche, nettoStunden, planDiff, planWarnungen, pruefStatus,
  sichtbareBaustellenIds, standardZeiten, urlaubstage, urlaubsstand, plusMonate
} from './regeln';
import { STANDARD_EINSTELLUNGEN, type Abwesenheit, type Einsatz, type Person } from './types';

const mia: Person = {
  id: 'mia', name: 'Mia', email: '', telefon: '', rolle: 'mitarbeiter', imPlan: true, azubi: true, jugendlichBis: '2028-03-01', aktivBis: null, winworkerNr: ''
};
const paula: Person = { ...mia, id: 'paula', name: 'Paula', azubi: false, jugendlichBis: null };

const einsatz = (id: string, personId: string, datum: string, beginn = '06:30', ende = '16:00', baustelleId = 'b1'): Einsatz => ({
  id, personId, baustelleId, datum, beginn, ende, notiz: ''
});

const abw = (personId: string, art: Abwesenheit['art'], von: string, bis: string, status: Abwesenheit['status'] = 'genehmigt'): Abwesenheit => ({
  id: `${personId}-${von}`, personId, art, von, bis, status, notiz: '', erstelltAm: von
});

describe('Datum', () => {
  it('findet den Montag und die Kalenderwoche', () => {
    expect(montagDerWoche('2026-10-29')).toBe('2026-10-26');
    expect(montagDerWoche('2026-11-01')).toBe('2026-10-26');
    expect(kalenderwoche('2026-10-26')).toBe(44);
    expect(kalenderwoche('2027-01-04')).toBe(1);
  });

  it('setzt freitags das frühere Ende', () => {
    expect(standardZeiten('2026-10-30', STANDARD_EINSTELLUNGEN)).toEqual({ beginn: '06:30', ende: '12:00' });
    expect(standardZeiten('2026-10-29', STANDARD_EINSTELLUNGEN)).toEqual({ beginn: '06:30', ende: '16:00' });
  });

  it('rechnet Monate ohne Überlauf am Monatsende', () => {
    expect(plusMonate('2026-01-31', 1)).toBe('2026-02-28');
    expect(plusMonate('2026-10-15', 12)).toBe('2027-10-15');
  });
});

describe('Arbeitszeit', () => {
  it('zieht für Jugendliche 60 Minuten Pause ab 6 Stunden ab', () => {
    expect(nettoStunden('06:30', '16:00', true)).toBe(8.5);
    expect(nettoStunden('06:30', '12:00', true)).toBe(5);
  });

  it('zieht für Erwachsene 45 Minuten ab 9 Stunden ab', () => {
    expect(nettoStunden('06:30', '16:00', false)).toBe(8.75);
    expect(nettoStunden('06:30', '12:00', false)).toBe(5.5);
  });
});

describe('Planwarnungen', () => {
  const montag = '2026-10-26';

  it('akzeptiert eine normale Woche von Mia mit 39 Stunden', () => {
    const plan = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map((d, i) => einsatz(`e${i}`, 'mia', d));
    plan.push(einsatz('fr', 'mia', '2026-10-30', '06:30', '12:00'));
    expect(planWarnungen(montag, [mia], plan, [])).toEqual([]);
  });

  it('warnt bei Berufsschule, zu langen Tagen und am Wochenende', () => {
    const plan = [
      einsatz('a', 'mia', '2026-11-09'),
      einsatz('b', 'mia', '2026-11-10', '06:00', '17:00'),
      einsatz('c', 'mia', '2026-11-14')
    ];
    const w = planWarnungen('2026-11-09', [mia], plan, [abw('mia', 'berufsschule', '2026-11-09', '2026-11-20')]).map((x) => x.text);
    expect(w).toContain('An diesem Tag eingetragen: Berufsschule');
    expect(w.some((t) => t.includes('10 Stunden'))).toBe(true);
    expect(w).toContain('Jugendliche: am Wochenende nicht einplanen');
  });

  it('warnt bei mehr als 40 Stunden und mehr als 5 Tagen', () => {
    const tage = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'];
    const plan = tage.map((d, i) => einsatz(`e${i}`, 'mia', d, '07:00', '15:00'));
    const w = planWarnungen(montag, [mia], plan, []).map((x) => x.text);
    expect(w.some((t) => t.includes('in der Woche'))).toBe(true);
    expect(w).toContain('Jugendliche: höchstens 5 Arbeitstage pro Woche');
  });

  it('warnt bei Erwachsenen nur bei Abwesenheit und Feiertag', () => {
    const plan = [einsatz('a', 'paula', '2026-10-31'), einsatz('b', 'paula', '2026-10-27')];
    const w = planWarnungen(montag, [paula], plan, [abw('paula', 'urlaub', '2026-10-27', '2026-10-27')]).map((x) => x.text);
    expect(w).toEqual(['Feiertag: Reformationstag', 'An diesem Tag eingetragen: Urlaub']);
  });

  it('ignoriert beantragten, noch nicht genehmigten Urlaub', () => {
    const plan = [einsatz('b', 'paula', '2026-10-27')];
    expect(planWarnungen(montag, [paula], plan, [abw('paula', 'urlaub', '2026-10-27', '2026-10-27', 'beantragt')])).toEqual([]);
  });

  it('behandelt Mia nach dem 18. Geburtstag als Erwachsene', () => {
    const plan = [einsatz('a', 'mia', '2028-03-06', '06:00', '17:00')];
    expect(planWarnungen('2028-03-06', [mia], plan, [])).toEqual([]);
  });
});

describe('planDiff', () => {
  it('findet neue, geänderte und gelöschte Einsätze und die Betroffenen', () => {
    const alt = [einsatz('1', 'paula', '2026-10-26'), einsatz('2', 'mia', '2026-10-26'), einsatz('3', 'mia', '2026-10-27')];
    const neu = [
      einsatz('1', 'paula', '2026-10-26'),
      { ...einsatz('2', 'mia', '2026-10-26'), baustelleId: 'b2' },
      einsatz('4', 'jannik', '2026-10-28')
    ];
    const d = planDiff(alt, neu);
    expect(d.speichern.map((e) => e.id)).toEqual(['2', '4']);
    expect(d.loeschen).toEqual(['3']);
    expect(d.betroffene).toEqual(['jannik', 'mia']);
  });

  it('benachrichtigt beide, wenn ein Einsatz die Person wechselt', () => {
    const d = planDiff([einsatz('1', 'paula', '2026-10-26')], [einsatz('1', 'mia', '2026-10-26')]);
    expect(d.betroffene).toEqual(['mia', 'paula']);
  });

  it('meldet nichts, wenn sich nichts ändert', () => {
    const plan = [einsatz('1', 'paula', '2026-10-26')];
    expect(planDiff(plan, plan)).toEqual({ speichern: [], loeschen: [], betroffene: [] });
  });
});

describe('Sichtbarkeit', () => {
  it('zeigt nur Baustellen, auf denen die Person zeitnah eingeplant ist', () => {
    const plan = [
      einsatz('1', 'paula', '2026-10-20', '06:30', '16:00', 'nah'),
      einsatz('2', 'paula', '2026-09-01', '06:30', '16:00', 'alt'),
      einsatz('3', 'paula', '2026-12-30', '06:30', '16:00', 'fern'),
      einsatz('4', 'mia', '2026-10-27', '06:30', '16:00', 'fremd')
    ];
    expect([...sichtbareBaustellenIds('paula', plan, '2026-10-26')]).toEqual(['nah']);
  });
});

describe('Urlaub', () => {
  it('zählt Arbeitstage ohne Feiertage', () => {
    // 26.10. bis 06.11.2026: 10 Werktage, davon kein Feiertag unter der Woche (31.10. ist Samstag)
    expect(urlaubstage('2026-10-26', '2026-11-06')).toBe(10);
    // Weihnachten 2026: 21.12. bis 01.01.: 10 Werktage, davon 25.12. und 01.01. Feiertage (26.12. ist Samstag)
    expect(urlaubstage('2026-12-21', '2027-01-01')).toBe(8);
  });

  it('rechnet den Rest ab dem Stand aus WinWorker', () => {
    const konto = { id: 'k', personId: 'paula', jahr: 2026, anspruch: 30, genommen: 20, standVom: '2026-09-30' };
    const antraege = [
      abw('paula', 'urlaub', '2026-09-28', '2026-10-02'), // bis 30.09. schon in WinWorker enthalten
      abw('paula', 'urlaub', '2026-11-02', '2026-11-06', 'beantragt'),
      abw('paula', 'urlaub', '2026-12-28', '2027-01-08', 'genehmigt')
    ];
    const s = urlaubsstand('paula', 2026, [konto], antraege);
    expect(s.seitdemGenehmigt).toBe(2 + 4); // 01.-02.10. sowie 28.-31.12.
    expect(s.beantragt).toBe(5);
    expect(s.rest).toBe(4);
  });
});

describe('Prüftermine und Krankmeldung', () => {
  it('erkennt fällige Prüfungen', () => {
    const p = { id: 'p', maschineId: 'm', art: 'DGUV V3', intervallMonate: 12, zuletzt: '2025-11-10' };
    expect(pruefStatus(p, '2026-10-26')).toBe('bald');
    expect(pruefStatus(p, '2026-11-11')).toBe('ueberfaellig');
    expect(pruefStatus({ ...p, zuletzt: '2026-06-01' }, '2026-10-26')).toBe('ok');
    expect(pruefStatus({ ...p, zuletzt: null }, '2026-10-26')).toBe('unbekannt');
  });

  it('rechnet "voraussichtlich bis" in Arbeitstagen', () => {
    expect(bisNachArbeitstagen('2026-10-26', 1)).toBe('2026-10-26');
    expect(bisNachArbeitstagen('2026-10-29', 3)).toBe('2026-11-02');
    expect(bisNachArbeitstagen('2026-11-17', 2)).toBe('2026-11-19'); // über Buß- und Bettag
  });
});
