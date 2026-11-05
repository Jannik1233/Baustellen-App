import { useState } from 'react';
import { Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { istAdmin, neueId, useDaten } from '../../lib/daten';
import { datumKurz, heuteIso, naechstePruefung, pruefStatus } from '../../lib/regeln';
import type { Maschine, MaschinenZustand, Pruefung } from '../../lib/types';
import { ZUSTAND } from '../Maschinen';

const PRUEF_TON = { ueberfaellig: 'rot', bald: 'gelb', ok: 'gruen', unbekannt: 'grau' } as const;

export function MaschinenVerwalten() {
  const { daten, benutzer, speichern } = useDaten();
  const zeigen = useHinweis();
  const admin = istAdmin(benutzer);
  const [offen, setOffen] = useState<string | null>(null);
  const [neu, setNeu] = useState('');
  const liste = [...daten.maschinen].sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung));

  return (
    <Seite titel="Maschinen verwalten">
      {admin && (
        <form
          className="formular reihe"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!neu.trim()) return;
            const id = neueId();
            await speichern('maschinen', { id, bezeichnung: neu.trim(), inventarNr: '', standortBaustelleId: null, zustand: 'ok', notiz: '' });
            setNeu('');
            setOffen(id);
            zeigen('Maschine angelegt.');
          }}
        >
          <input value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="Neue Maschine, zum Beispiel Airless Graco 395" />
          <button className="knopf haupt">Anlegen</button>
        </form>
      )}
      {liste.map((m) => (
        <MaschinenKarte key={m.id} maschine={m} offen={offen === m.id} umschalten={() => setOffen(offen === m.id ? null : m.id)} admin={admin} />
      ))}
    </Seite>
  );
}

function MaschinenKarte({ maschine: m, offen, umschalten, admin }: { maschine: Maschine; offen: boolean; umschalten: () => void; admin: boolean }) {
  const { daten, speichern, loeschen } = useDaten();
  const heute = heuteIso();
  const [neuePruefung, setNeuePruefung] = useState({ art: 'DGUV V3', intervallMonate: '12', zuletzt: '' });
  const pruefungen = daten.pruefungen.filter((p) => p.maschineId === m.id);
  const aendern = (teil: Partial<Maschine>) => void speichern('maschinen', { ...m, ...teil });
  const pruefungAendern = (p: Pruefung, teil: Partial<Pruefung>) => void speichern('pruefungen', { ...p, ...teil });

  return (
    <div className="karte stapel">
      <button className="zeile-knopf" onClick={umschalten}>
        <span className="wachsen">
          <strong>{m.bezeichnung}</strong>
          <span className="leise-text">{m.standortBaustelleId ? daten.baustellen.find((b) => b.id === m.standortBaustelleId)?.name : 'Im Lager'}</span>
        </span>
        <Marke ton={ZUSTAND[m.zustand].ton}>{ZUSTAND[m.zustand].text}</Marke>
        {pruefungen.map((p) => (
          <Marke key={p.id} ton={PRUEF_TON[pruefStatus(p, heute)]}>
            {p.art} {naechstePruefung(p) ? datumKurz(naechstePruefung(p)) : 'Datum fehlt'}
          </Marke>
        ))}
      </button>

      {offen && (
        <div className="formular">
          {admin && (
            <div className="zwei">
              <label>
                Bezeichnung
                <input defaultValue={m.bezeichnung} onBlur={(e) => e.target.value.trim() && e.target.value !== m.bezeichnung && aendern({ bezeichnung: e.target.value.trim() })} />
              </label>
              <label>
                Inventarnummer
                <input defaultValue={m.inventarNr} onBlur={(e) => e.target.value !== m.inventarNr && aendern({ inventarNr: e.target.value.trim() })} />
              </label>
            </div>
          )}
          <div className="zwei">
            <label>
              Standort
              <select value={m.standortBaustelleId ?? ''} onChange={(e) => aendern({ standortBaustelleId: e.target.value || null })}>
                <option value="">Im Lager</option>
                {daten.baustellen
                  .filter((b) => b.status !== 'abgeschlossen')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Zustand
              <select value={m.zustand} onChange={(e) => aendern({ zustand: e.target.value as MaschinenZustand })}>
                {(Object.keys(ZUSTAND) as MaschinenZustand[]).map((z) => (
                  <option key={z} value={z}>
                    {ZUSTAND[z].text}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Notiz
            <input defaultValue={m.notiz} onBlur={(e) => e.target.value !== m.notiz && aendern({ notiz: e.target.value.trim() })} />
          </label>

          <h3>Prüfungen</h3>
          {pruefungen.map((p) => (
            <div key={p.id} className="zeile umbrechen">
              <div className="wachsen">
                <strong>{p.art}</strong>
                <div className="leise-text">
                  alle {p.intervallMonate} Monate · zuletzt {p.zuletzt ? datumKurz(p.zuletzt) : 'unbekannt'} · nächste {naechstePruefung(p) ? datumKurz(naechstePruefung(p)) : 'offen'}
                </div>
              </div>
              {admin && (
                <>
                  <input type="date" value={p.zuletzt ?? ''} onChange={(e) => pruefungAendern(p, { zuletzt: e.target.value || null })} aria-label="Zuletzt geprüft" />
                  <button className="knopf klein" onClick={() => pruefungAendern(p, { zuletzt: heute })}>
                    Heute geprüft
                  </button>
                  <button className="knopf klein flach" onClick={() => void loeschen('pruefungen', p.id)}>
                    Entfernen
                  </button>
                </>
              )}
            </div>
          ))}
          {admin && (
            <div className="formular reihe">
              <input value={neuePruefung.art} onChange={(e) => setNeuePruefung({ ...neuePruefung, art: e.target.value })} placeholder="Art, zum Beispiel DGUV V3 oder UVV" />
              <label>
                Monate
                <input inputMode="numeric" value={neuePruefung.intervallMonate} onChange={(e) => setNeuePruefung({ ...neuePruefung, intervallMonate: e.target.value })} />
              </label>
              <label>
                Zuletzt
                <input type="date" value={neuePruefung.zuletzt} onChange={(e) => setNeuePruefung({ ...neuePruefung, zuletzt: e.target.value })} />
              </label>
              <button
                className="knopf"
                disabled={!neuePruefung.art.trim() || !(Number(neuePruefung.intervallMonate) > 0)}
                onClick={async () => {
                  await speichern('pruefungen', {
                    id: neueId(),
                    maschineId: m.id,
                    art: neuePruefung.art.trim(),
                    intervallMonate: Number(neuePruefung.intervallMonate),
                    zuletzt: neuePruefung.zuletzt || null
                  });
                  setNeuePruefung({ art: 'DGUV V3', intervallMonate: '12', zuletzt: '' });
                }}
              >
                Prüfung hinzufügen
              </button>
            </div>
          )}
          {admin && (
            <button className="knopf klein flach" onClick={() => window.confirm(`${m.bezeichnung} wirklich löschen?`) && void loeschen('maschinen', m.id)}>
              Maschine löschen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
