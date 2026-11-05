import { Link } from 'react-router-dom';
import { Marke, Seite } from '../komponenten/Bausteine';
import { useNamen } from '../lib/ansicht';
import { istBuero, useDaten } from '../lib/daten';
import { datumKurz, heuteIso, naechstePruefung, pruefStatus } from '../lib/regeln';
import type { MaschinenZustand } from '../lib/types';

export const ZUSTAND: Record<MaschinenZustand, { text: string; ton: 'gruen' | 'rot' | 'gelb' }> = {
  ok: { text: 'In Ordnung', ton: 'gruen' },
  defekt: { text: 'Defekt', ton: 'rot' },
  reparatur: { text: 'In Reparatur', ton: 'gelb' }
};

// Wo steht welche Maschine, und ist sie geprüft. Für alle lesbar.
export function Maschinen() {
  const { daten, benutzer } = useDaten();
  const namen = useNamen();
  const heute = heuteIso();
  const liste = [...daten.maschinen].sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung));

  return (
    <Seite titel="Maschinen" zurueck="/mehr" aktion={istBuero(benutzer) ? <Link className="knopf klein" to="/buero/maschinen">Verwalten</Link> : undefined}>
      {liste.map((m) => {
        const pruefungen = daten.pruefungen.filter((p) => p.maschineId === m.id);
        const faellig = pruefungen.filter((p) => pruefStatus(p, heute) === 'ueberfaellig');
        return (
          <div key={m.id} className="zeile">
            <div className="wachsen">
              <strong>{m.bezeichnung}</strong>
              <div className="leise-text">
                {m.inventarNr && `Nr. ${m.inventarNr} · `}
                {m.standortBaustelleId ? namen.baustelle(m.standortBaustelleId) : 'Im Lager'}
              </div>
              {pruefungen.map((p) => (
                <div key={p.id} className="leise-text">
                  {p.art}: {naechstePruefung(p) ? `nächste ${datumKurz(naechstePruefung(p))}` : 'Datum fehlt'}
                </div>
              ))}
            </div>
            {faellig.length > 0 ? <Marke ton="rot">Prüfung fällig</Marke> : <Marke ton={ZUSTAND[m.zustand].ton}>{ZUSTAND[m.zustand].text}</Marke>}
          </div>
        );
      })}
    </Seite>
  );
}
