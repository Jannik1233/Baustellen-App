import { useState } from 'react';
import { DateiBild, Leer, Marke, Seite } from '../../komponenten/Bausteine';
import { useNamen, zeitpunkt } from '../../lib/ansicht';
import { useDaten } from '../../lib/daten';
import { datumKurz, heuteIso } from '../../lib/regeln';
import type { Meldung, MeldungStatus } from '../../lib/types';
import { MELDUNG_STATUS } from '../MeineMeldungen';

type Filter = 'aktiv' | 'erledigt';

export function Meldungen() {
  const { daten, speichern } = useDaten();
  const namen = useNamen();
  const [filter, setFilter] = useState<Filter>('aktiv');
  const heute = heuteIso();

  const liste = daten.meldungen
    .filter((m) => (filter === 'aktiv' ? m.status !== 'erledigt' : m.status === 'erledigt'))
    .sort((a, b) =>
      filter === 'aktiv'
        ? Number(b.arbeitSteht) - Number(a.arbeitSteht) || (a.benoetigtBis ?? '9').localeCompare(b.benoetigtBis ?? '9') || a.erstelltAm.localeCompare(b.erstelltAm)
        : (b.erledigtAm ?? '').localeCompare(a.erledigtAm ?? '')
    );

  // Das Erledigt-Datum setzt im Echtbetrieb die Datenbank, hier zusätzlich für den Demo-Modus
  const setzen = (m: Meldung, status: MeldungStatus) => void speichern('meldungen', { ...m, status, erledigtAm: status === 'erledigt' ? new Date().toISOString() : null });

  return (
    <Seite titel="Meldungen">
      <div className="umschalter">
        <button className={filter === 'aktiv' ? 'an' : ''} onClick={() => setFilter('aktiv')}>
          Offen
        </button>
        <button className={filter === 'erledigt' ? 'an' : ''} onClick={() => setFilter('erledigt')}>
          Erledigt
        </button>
      </div>
      {!liste.length && <Leer>{filter === 'aktiv' ? 'Keine offenen Meldungen.' : 'Noch nichts erledigt.'}</Leer>}
      {liste.map((m) => {
        const maschine = daten.maschinen.find((x) => x.id === m.maschineId);
        return (
          <div key={m.id} className="karte meldung">
            {m.fotoPfad && <DateiBild pfad={m.fotoPfad} alt="Foto zur Meldung" klein />}
            <div className="wachsen stapel">
              <strong>{m.art === 'material' ? `Material: ${m.material}` : `Maschine: ${maschine?.bezeichnung ?? 'nicht in der Liste'}`}</strong>
              <div className="marken">
                {m.arbeitSteht && <Marke ton="rot">Arbeit steht</Marke>}
                {m.benoetigtBis && <Marke ton={m.benoetigtBis <= heute ? 'rot' : 'gelb'}>bis {datumKurz(m.benoetigtBis)}</Marke>}
                <Marke ton={MELDUNG_STATUS[m.status].ton}>{MELDUNG_STATUS[m.status].text}</Marke>
              </div>
              {m.menge && <div>Menge: {m.menge}</div>}
              {m.beschreibung && <div>{m.beschreibung}</div>}
              <div className="leise-text">
                {namen.person(m.melderId)} · {namen.baustelle(m.baustelleId)} · {zeitpunkt(m.erstelltAm)}
                {m.erledigtAm && ` · erledigt ${zeitpunkt(m.erledigtAm)}`}
              </div>
              <div className="knopfreihe">
                {m.status === 'offen' && (
                  <button className="knopf klein" onClick={() => setzen(m, 'in_bearbeitung')}>
                    Kümmere mich
                  </button>
                )}
                {m.status !== 'erledigt' && (
                  <button className="knopf klein haupt" onClick={() => setzen(m, 'erledigt')}>
                    Erledigt
                  </button>
                )}
                {m.status === 'erledigt' && (
                  <button className="knopf klein flach" onClick={() => setzen(m, 'offen')}>
                    Wieder öffnen
                  </button>
                )}
                {maschine && maschine.zustand === 'ok' && m.status !== 'erledigt' && (
                  <button className="knopf klein" onClick={() => void speichern('maschinen', { ...maschine, zustand: 'defekt' })}>
                    Maschine als defekt eintragen
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </Seite>
  );
}
