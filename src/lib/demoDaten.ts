// Startbestand für den Demo-Modus: nur das Team und Mias Schulblöcke, keine Baustellen, Meldungen oder Pläne.
// Mias Schulblöcke stammen aus dem Schuljahresablaufplan des BSZ Bau und Technik Dresden 2026/2027 (C-Block).

import { leererBestand, STANDARD_EINSTELLUNGEN, type Abwesenheit, type Bestand } from './types';

export const DEMO_PERSONEN = {
  jannik: 'p-jannik',
  martina: 'p-martina',
  paula: 'p-paula',
  mia: 'p-mia'
};

const SCHULBLOECKE_MIA: [string, string][] = [
  ['2026-09-14', '2026-09-25'],
  ['2026-11-09', '2026-11-20'],
  ['2027-01-04', '2027-01-15'],
  ['2027-03-15', '2027-03-26'],
  ['2027-05-03', '2027-05-06'], // 07.05. unterrichtsfrei: Mia ist im Betrieb
  ['2027-05-10', '2027-05-17'], // 18.05. unterrichtsfrei: Mia ist im Betrieb
  ['2027-05-19', '2027-05-21'],
  ['2027-06-21', '2027-07-09']
];

export function demoDaten(): Bestand {
  const d = leererBestand();
  const { jannik, martina, paula, mia } = DEMO_PERSONEN;
  const jetzt = new Date().toISOString();

  d.personen = [
    { id: jannik, name: 'Jannik Schuster', email: 'meister@maler-riesa.de', telefon: '', rolle: 'admin', imPlan: true, azubi: false, jugendlichBis: null, aktivBis: null, winworkerNr: '' },
    { id: martina, name: 'Martina Schuster', email: '', telefon: '', rolle: 'buero', imPlan: false, azubi: false, jugendlichBis: null, aktivBis: null, winworkerNr: '' },
    { id: paula, name: 'Paula Krüger', email: '', telefon: '', rolle: 'mitarbeiter', imPlan: true, azubi: false, jugendlichBis: null, aktivBis: null, winworkerNr: '' },
    // Geburtstag ist nicht hinterlegt: bitte das echte Datum des 18. Geburtstags eintragen
    { id: mia, name: 'Mia Guhlemann', email: '', telefon: '', rolle: 'mitarbeiter', imPlan: true, azubi: true, jugendlichBis: '2028-01-01', aktivBis: null, winworkerNr: '' }
  ];

  // Mias Berufsschulblöcke sind echte Termine und bleiben eingetragen.
  d.abwesenheiten = SCHULBLOECKE_MIA.map(([von, bis]): Abwesenheit => ({
    id: `a-schule-${von}`, personId: mia, art: 'berufsschule', von, bis, status: 'genehmigt', notiz: 'BSZ Bau und Technik Dresden, C-Block', erstelltAm: jetzt
  }));

  d.einstellungen = [STANDARD_EINSTELLUNGEN];
  return d;
}
