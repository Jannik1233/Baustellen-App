import { describe, expect, it } from 'vitest';
import { arbeitstageBis, feiertageSachsen, ostersonntag, plusArbeitstage, isoDatum } from './arbeitstage';

describe('Feiertage Sachsen', () => {
  it('berechnet Ostern korrekt', () => {
    expect(isoDatum(ostersonntag(2026))).toBe('2026-04-05');
    expect(isoDatum(ostersonntag(2027))).toBe('2027-03-28');
  });

  it('enthält Reformationstag und Buß- und Bettag', () => {
    const f = feiertageSachsen(2026);
    expect(f.get('2026-10-31')).toBe('Reformationstag');
    expect(f.get('2026-11-18')).toBe('Buß- und Bettag');
    expect(feiertageSachsen(2027).get('2027-11-17')).toBe('Buß- und Bettag');
  });
});

describe('plusArbeitstage', () => {
  it('überspringt Wochenenden', () => {
    // Freitag 16.10.2026 plus 1 Arbeitstag = Montag 19.10.2026
    expect(plusArbeitstage('2026-10-16', 1)).toBe('2026-10-19');
  });

  it('setzt die Angebotsfrist auf 5 Arbeitstage', () => {
    // Dienstag 20.10.2026 plus 5 = Dienstag 27.10.2026
    expect(plusArbeitstage('2026-10-20', 5)).toBe('2026-10-27');
  });

  it('überspringt Feiertage', () => {
    // Dienstag 17.11.2026 plus 1: Mittwoch ist Buß- und Bettag, also Donnerstag
    expect(plusArbeitstage('2026-11-17', 1)).toBe('2026-11-19');
    // Mittwoch 23.12.2026 plus 2: 24.12. zählt, 25. und 26. nicht, dann Wochenende, also Montag 28.12.
    expect(plusArbeitstage('2026-12-23', 2)).toBe('2026-12-28');
  });
});

describe('arbeitstageBis', () => {
  it('erkennt heute fällig, zukünftig und überfällig', () => {
    expect(arbeitstageBis('2026-10-20', '2026-10-20')).toBe(0);
    expect(arbeitstageBis('2026-10-27', '2026-10-20')).toBe(5);
    expect(arbeitstageBis('2026-10-16', '2026-10-19')).toBe(-1);
  });
});
