import { Link } from 'react-router-dom';
import { useNamen } from '../lib/ansicht';
import { useDaten } from '../lib/daten';
import { adresse, navigationsLink } from '../lib/regeln';
import type { Einsatz } from '../lib/types';
import { Symbol } from './Symbol';

// Ein Einsatz mit Ort, Zeit, Kollegen und den zwei wichtigsten Wegen: Navigation und Baustellenblatt
export function EinsatzKarte({ einsatz, kompakt }: { einsatz: Einsatz; kompakt?: boolean }) {
  const { daten, benutzer } = useDaten();
  const namen = useNamen();
  const baustelle = daten.baustellen.find((b) => b.id === einsatz.baustelleId);
  const kollegen = daten.einsaetze
    .filter((e) => e.baustelleId === einsatz.baustelleId && e.datum === einsatz.datum && e.personId !== benutzer?.id)
    .map((e) => namen.person(e.personId).split(' ')[0]);

  return (
    <div className={`karte einsatz ${kompakt ? 'kompakt' : ''}`}>
      <div className="einsatz-zeit">
        {einsatz.beginn} bis {einsatz.ende} Uhr
      </div>
      <Link to={`/baustelle/${einsatz.baustelleId}`} className="einsatz-name">
        {baustelle?.name ?? 'Baustelle'}
        <Symbol name="pfeil" groesse={18} />
      </Link>
      {baustelle && <div className="einsatz-adresse">{adresse(baustelle)}</div>}
      {kollegen.length > 0 && <div className="einsatz-mit">Mit {kollegen.join(', ')}</div>}
      {einsatz.notiz && <div className="einsatz-notiz">{einsatz.notiz}</div>}
      {!kompakt && baustelle && (
        <div className="knopfreihe">
          <a className="knopf" href={navigationsLink(baustelle)} target="_blank" rel="noreferrer">
            <Symbol name="navigation" /> Hinfahren
          </a>
          <Link className="knopf" to={`/baustelle/${baustelle.id}`}>
            <Symbol name="baustelle" /> Baustellenblatt
          </Link>
        </div>
      )}
    </div>
  );
}
