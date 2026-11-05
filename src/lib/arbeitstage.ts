// Arbeitstage: Montag bis Freitag, ohne gesetzliche Feiertage in Sachsen. Übernommen aus der EBT-App.
// Datumswerte werden als 'JJJJ-MM-TT' in lokaler Zeit behandelt.

export function isoDatum(d: Date): string {
  const j = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${j}-${m}-${t}`;
}

export function parseDatum(iso: string): Date {
  const [j, m, t] = iso.slice(0, 10).split('-').map(Number);
  return new Date(j, m - 1, t);
}

function plusTage(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Ostersonntag nach dem Algorithmus von Meeus/Jones/Butcher
export function ostersonntag(jahr: number): Date {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

// Buß- und Bettag: Mittwoch vor dem 23. November
function bussUndBettag(jahr: number): Date {
  const d = new Date(jahr, 10, 22);
  while (d.getDay() !== 3) d.setDate(d.getDate() - 1);
  return d;
}

const cache = new Map<number, Map<string, string>>();

export function feiertageSachsen(jahr: number): Map<string, string> {
  const vorhanden = cache.get(jahr);
  if (vorhanden) return vorhanden;
  const ostern = ostersonntag(jahr);
  const liste: [Date, string][] = [
    [new Date(jahr, 0, 1), 'Neujahr'],
    [plusTage(ostern, -2), 'Karfreitag'],
    [plusTage(ostern, 1), 'Ostermontag'],
    [new Date(jahr, 4, 1), 'Tag der Arbeit'],
    [plusTage(ostern, 39), 'Christi Himmelfahrt'],
    [plusTage(ostern, 50), 'Pfingstmontag'],
    [new Date(jahr, 9, 3), 'Tag der Deutschen Einheit'],
    [new Date(jahr, 9, 31), 'Reformationstag'],
    [bussUndBettag(jahr), 'Buß- und Bettag'],
    [new Date(jahr, 11, 25), '1. Weihnachtstag'],
    [new Date(jahr, 11, 26), '2. Weihnachtstag']
  ];
  const map = new Map(liste.map(([d, name]) => [isoDatum(d), name]));
  cache.set(jahr, map);
  return map;
}

export function istArbeitstag(d: Date): boolean {
  const wt = d.getDay();
  if (wt === 0 || wt === 6) return false;
  return !feiertageSachsen(d.getFullYear()).has(isoDatum(d));
}

// Frist = Starttag plus n Arbeitstage. Der Starttag selbst zählt nicht mit.
export function plusArbeitstage(start: string | Date, n: number): string {
  let d = typeof start === 'string' ? parseDatum(start) : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  let rest = n;
  while (rest > 0) {
    d = plusTage(d, 1);
    if (istArbeitstag(d)) rest--;
  }
  return isoDatum(d);
}

// Anzahl Arbeitstage von heute bis zur Frist. Negativ bei Überfälligkeit, 0 wenn heute fällig.
export function arbeitstageBis(frist: string, heute: string = isoDatum(new Date())): number {
  if (frist === heute) return 0;
  const vorwaerts = frist > heute;
  let d = parseDatum(heute);
  const ziel = frist;
  let zaehler = 0;
  while (isoDatum(d) !== ziel) {
    d = plusTage(d, vorwaerts ? 1 : -1);
    if (istArbeitstag(d)) zaehler++;
  }
  return vorwaerts ? zaehler : -Math.max(zaehler, 1);
}

// Erster Arbeitstag ab dem Datum, das Datum selbst eingeschlossen
export function naechsterArbeitstag(datum: string): string {
  return istArbeitstag(parseDatum(datum)) ? datum : plusArbeitstage(datum, 1);
}

// Letzter Tag eines Bauabschnitts: der Beginn zählt als erster Arbeitstag
export function abschnittEnde(beginn: string, dauer: number): string {
  return plusArbeitstage(naechsterArbeitstag(beginn), Math.max(1, dauer) - 1);
}
