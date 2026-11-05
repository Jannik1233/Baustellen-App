import { useState } from 'react';
import { Seite } from '../komponenten/Bausteine';
import { StundenKarte } from '../komponenten/StundenKarte';
import { useDaten } from '../lib/daten';
import { datumKurz, heuteIso, kalenderwoche, montagDerWoche, plusTage, tageDerWoche } from '../lib/regeln';
import { alsDauer, sollEintragen, stundeNettoMin, stundenAm } from '../lib/stunden';

export function MeineStunden() {
  const { daten, benutzer } = useDaten();
  const heute = heuteIso();
  const [montag, setMontag] = useState(montagDerWoche(heute));
  if (!benutzer) return null;

  // Alle Tage der Woche bis heute, an denen gearbeitet werden sollte oder schon etwas eingetragen ist
  const tage = tageDerWoche(montag, 7).filter(
    (d) => d <= heute && (sollEintragen(benutzer, d, daten.einsaetze, daten.abwesenheiten) || stundenAm(daten.stunden, benutzer.id, d).length > 0)
  );
  const summe = daten.stunden
    .filter((s) => s.personId === benutzer.id && s.datum >= montag && s.datum <= plusTage(montag, 6))
    .reduce((n, s) => n + stundeNettoMin(s), 0);

  return (
    <Seite titel="Meine Stunden">
      <div className="knopfreihe">
        <button className="knopf" onClick={() => setMontag(plusTage(montag, -7))} aria-label="Woche davor">
          ‹
        </button>
        <strong>
          KW {kalenderwoche(montag)} · {datumKurz(montag)} bis {datumKurz(plusTage(montag, 6))}
        </strong>
        <button className="knopf" disabled={montag >= montagDerWoche(heute)} onClick={() => setMontag(plusTage(montag, 7))} aria-label="Woche danach">
          ›
        </button>
      </div>
      <p className="leise-text">Diese Woche: {alsDauer(summe)} Stunden. Bis das Büro freigibt, kannst du jeden Tag selbst ändern.</p>
      {!tage.length && <div className="karte leise">In dieser Woche gibt es keine Tage zum Eintragen.</div>}
      {[...tage].reverse().map((d) => (
        <StundenKarte key={d} datum={d} titel={d === heute ? 'Heute' : undefined} />
      ))}
    </Seite>
  );
}
