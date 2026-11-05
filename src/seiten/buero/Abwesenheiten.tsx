import { useState } from 'react';
import { Leer, Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { useNamen } from '../../lib/ansicht';
import { istAdmin, neueId, useDaten } from '../../lib/daten';
import { ABWESENHEIT_TEXT, datumKurz, heuteIso, plusTage, urlaubstage, urlaubsstand } from '../../lib/regeln';
import type { Abwesenheit, AbwesenheitArt, Urlaubskonto } from '../../lib/types';
import { ANTRAG_STATUS } from '../Urlaub';

export function Abwesenheiten() {
  const { daten, benutzer, speichern, loeschen } = useDaten();
  const namen = useNamen();
  const zeigen = useHinweis();
  const admin = istAdmin(benutzer);
  const heute = heuteIso();
  const jahr = Number(heute.slice(0, 4));
  const [ablehnen, setAblehnen] = useState<{ id: string; grund: string } | null>(null);
  const [neu, setNeu] = useState({ personId: '', art: 'berufsschule' as AbwesenheitArt, von: '', bis: '', notiz: '' });

  const personen = daten.personen.filter((p) => !p.aktivBis || p.aktivBis >= heute).sort((a, b) => a.name.localeCompare(b.name));
  const antraege = daten.abwesenheiten.filter((a) => a.status === 'beantragt').sort((a, b) => a.von.localeCompare(b.von));
  const kommende = daten.abwesenheiten
    .filter((a) => a.status === 'genehmigt' && a.bis >= heute && a.von <= plusTage(heute, 120))
    .sort((a, b) => a.von.localeCompare(b.von));

  const entscheiden = (a: Abwesenheit, status: 'genehmigt' | 'abgelehnt', notiz = a.notiz) => speichern('abwesenheiten', { ...a, status, notiz });

  async function eintragen(e: React.FormEvent) {
    e.preventDefault();
    if (!neu.personId || !neu.von || !neu.bis || neu.bis < neu.von) return;
    await speichern('abwesenheiten', { id: neueId(), ...neu, notiz: neu.notiz.trim(), status: 'genehmigt', erstelltAm: new Date().toISOString() });
    setNeu({ ...neu, von: '', bis: '', notiz: '' });
    zeigen('Eingetragen.');
  }

  return (
    <Seite titel="Urlaub und Abwesenheit">
      <section>
        <h2>Anträge</h2>
        {!antraege.length && <Leer>Keine offenen Anträge.</Leer>}
        {antraege.map((a) => {
          const stand = urlaubsstand(a.personId, Number(a.von.slice(0, 4)), daten.urlaubskonten, daten.abwesenheiten);
          return (
            <div key={a.id} className="karte stapel">
              <strong>
                {namen.person(a.personId)}: {datumKurz(a.von)} bis {datumKurz(a.bis)}, {urlaubstage(a.von, a.bis)} Arbeitstage
              </strong>
              {a.notiz && <div>{a.notiz}</div>}
              <div className="leise-text">
                Rest danach: {stand.rest - urlaubstage(a.von, a.bis)} Tage (Anspruch {stand.anspruch})
              </div>
              {admin && ablehnen?.id !== a.id && (
                <div className="knopfreihe">
                  <button className="knopf haupt" onClick={() => void entscheiden(a, 'genehmigt').then(() => zeigen('Genehmigt.'))}>
                    Genehmigen
                  </button>
                  <button className="knopf" onClick={() => setAblehnen({ id: a.id, grund: '' })}>
                    Ablehnen
                  </button>
                </div>
              )}
              {admin && ablehnen?.id === a.id && (
                <div className="stapel">
                  <input autoFocus value={ablehnen.grund} onChange={(e) => setAblehnen({ ...ablehnen, grund: e.target.value })} placeholder="Grund, zum Beispiel Großauftrag in dieser Woche" />
                  <div className="knopfreihe">
                    <button
                      className="knopf rot"
                      onClick={async () => {
                        await entscheiden(a, 'abgelehnt', ablehnen.grund.trim());
                        setAblehnen(null);
                        zeigen('Abgelehnt.');
                      }}
                    >
                      Ablehnen
                    </button>
                    <button className="knopf flach" onClick={() => setAblehnen(null)}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
              {!admin && <p className="leise-text">Genehmigen kann Jannik.</p>}
            </div>
          );
        })}
      </section>

      <section>
        <h2>Die nächsten Monate</h2>
        {!kommende.length && <Leer>Nichts eingetragen.</Leer>}
        {kommende.map((a) => (
          <div key={a.id} className="zeile">
            <div className="wachsen">
              <strong>{namen.person(a.personId)}</strong>
              <div className="leise-text">
                {ABWESENHEIT_TEXT[a.art]}: {datumKurz(a.von)}
                {a.bis !== a.von && ` bis ${datumKurz(a.bis)}`}
                {a.notiz && ` · ${a.notiz}`}
              </div>
            </div>
            <Marke ton={ANTRAG_STATUS[a.status].ton}>{ANTRAG_STATUS[a.status].text}</Marke>
            {admin && (
              <button className="knopf klein flach" onClick={() => void loeschen('abwesenheiten', a.id)}>
                Löschen
              </button>
            )}
          </div>
        ))}
      </section>

      {admin && (
        <form className="karte formular" onSubmit={eintragen}>
          <h2>Eintragen</h2>
          <p className="leise-text">Für Berufsschulblöcke, Lehrgänge oder Urlaub, der schon abgesprochen ist. Krankheit meldet jeder selbst über die App.</p>
          <select value={neu.personId} onChange={(e) => setNeu({ ...neu, personId: e.target.value })} required>
            <option value="">Person wählen</option>
            {personen.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={neu.art} onChange={(e) => setNeu({ ...neu, art: e.target.value as AbwesenheitArt })}>
            {(['berufsschule', 'urlaub', 'sonstiges'] as AbwesenheitArt[]).map((a) => (
              <option key={a} value={a}>
                {ABWESENHEIT_TEXT[a]}
              </option>
            ))}
          </select>
          <div className="zwei">
            <label>
              Von
              <input type="date" value={neu.von} onChange={(e) => setNeu({ ...neu, von: e.target.value })} required />
            </label>
            <label>
              Bis
              <input type="date" value={neu.bis} min={neu.von} onChange={(e) => setNeu({ ...neu, bis: e.target.value })} required />
            </label>
          </div>
          <input value={neu.notiz} onChange={(e) => setNeu({ ...neu, notiz: e.target.value })} placeholder="Bemerkung (keine Krankheitsgründe)" />
          <button className="knopf haupt">Eintragen</button>
        </form>
      )}

      <section>
        <h2>Urlaubskonten {jahr}</h2>
        <p className="leise-text">Anspruch und genommene Tage aus WinWorker übertragen. Was danach in der App genehmigt wird, zieht die App selbst ab.</p>
        {personen.map((p) => (
          <KontoZeile key={p.id} personId={p.id} jahr={jahr} admin={admin} />
        ))}
      </section>
    </Seite>
  );
}

function KontoZeile({ personId, jahr, admin }: { personId: string; jahr: number; admin: boolean }) {
  const { daten, speichern } = useDaten();
  const namen = useNamen();
  const zeigen = useHinweis();
  const konto = daten.urlaubskonten.find((k) => k.personId === personId && k.jahr === jahr);
  const [werte, setWerte] = useState({ anspruch: String(konto?.anspruch ?? ''), genommen: String(konto?.genommen ?? ''), standVom: konto?.standVom ?? heuteIso() });
  const stand = urlaubsstand(personId, jahr, daten.urlaubskonten, daten.abwesenheiten);

  async function sichern() {
    const k: Urlaubskonto = { id: konto?.id ?? neueId(), personId, jahr, anspruch: Number(werte.anspruch) || 0, genommen: Number(werte.genommen) || 0, standVom: werte.standVom };
    await speichern('urlaubskonten', k);
    zeigen('Urlaubskonto gespeichert.');
  }

  return (
    <div className="zeile umbrechen">
      <div className="wachsen">
        <strong>{namen.person(personId)}</strong>
        <div className="leise-text">
          Rest {stand.rest} · beantragt {stand.beantragt}
        </div>
      </div>
      {admin && (
        <div className="formular reihe">
          <label>
            Anspruch
            <input inputMode="numeric" value={werte.anspruch} onChange={(e) => setWerte({ ...werte, anspruch: e.target.value })} />
          </label>
          <label>
            Genommen laut WinWorker
            <input inputMode="decimal" value={werte.genommen} onChange={(e) => setWerte({ ...werte, genommen: e.target.value })} />
          </label>
          <label>
            Stand vom
            <input type="date" value={werte.standVom} onChange={(e) => setWerte({ ...werte, standVom: e.target.value })} />
          </label>
          <button className="knopf" onClick={sichern}>
            Speichern
          </button>
        </div>
      )}
    </div>
  );
}
