import { useState } from 'react';
import { Leer, Marke, Seite } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { neueId, useDaten } from '../lib/daten';
import { ABWESENHEIT_TEXT, datumKurz, heuteIso, urlaubstage, urlaubsstand } from '../lib/regeln';
import type { AntragStatus } from '../lib/types';

export const ANTRAG_STATUS: Record<AntragStatus, { text: string; ton: 'gelb' | 'gruen' | 'rot' }> = {
  beantragt: { text: 'Beantragt', ton: 'gelb' },
  genehmigt: { text: 'Genehmigt', ton: 'gruen' },
  abgelehnt: { text: 'Abgelehnt', ton: 'rot' }
};

export function Urlaub() {
  const { daten, benutzer, speichern, loeschen } = useDaten();
  const zeigen = useHinweis();
  const heute = heuteIso();
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [notiz, setNotiz] = useState('');
  if (!benutzer) return null;

  const jahr = Number(heute.slice(0, 4));
  const stand = urlaubsstand(benutzer.id, jahr, daten.urlaubskonten, daten.abwesenheiten);
  const gueltig = von && bis && von <= bis;
  const tage = gueltig ? urlaubstage(von, bis) : 0;
  const eigene = daten.abwesenheiten
    .filter((a) => a.personId === benutzer.id && a.bis >= `${jahr - 1}-12-01` && !a.id.startsWith('krank-'))
    .sort((a, b) => b.von.localeCompare(a.von));

  async function beantragen(e: React.FormEvent) {
    e.preventDefault();
    if (!gueltig) return;
    await speichern('abwesenheiten', { id: neueId(), personId: benutzer!.id, art: 'urlaub', von, bis, status: 'beantragt', notiz: notiz.trim(), erstelltAm: new Date().toISOString() });
    setVon('');
    setBis('');
    setNotiz('');
    zeigen('Urlaubsantrag gesendet.');
  }

  return (
    <Seite titel="Urlaub" zurueck="/mehr">
      <div className="karte zahlen">
        <div>
          <span className="zahl">{stand.rest}</span>
          <span>Tage übrig {jahr}</span>
        </div>
        <div>
          <span className="zahl klein">{stand.anspruch}</span>
          <span>Anspruch</span>
        </div>
        <div>
          <span className="zahl klein">{stand.beantragt}</span>
          <span>beantragt</span>
        </div>
      </div>
      <p className="leise-text">
        {stand.standVom
          ? `Stand aus WinWorker vom ${datumKurz(stand.standVom)}: ${stand.genommenLautWinworker} Tage genommen. Danach genehmigt: ${stand.seitdemGenehmigt} Tage.`
          : 'Für dieses Jahr ist noch kein Urlaubskonto eingetragen. Bitte im Büro fragen.'}
      </p>

      <form className="karte stapel" onSubmit={beantragen}>
        <h2>Urlaub beantragen</h2>
        <label>
          Von
          <input type="date" min={heute} value={von} onChange={(e) => setVon(e.target.value)} required />
        </label>
        <label>
          Bis
          <input type="date" min={von || heute} value={bis} onChange={(e) => setBis(e.target.value)} required />
        </label>
        <input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Bemerkung (freiwillig)" />
        {gueltig && <p>Das sind {tage} Arbeitstage. Feiertage und Wochenenden zählen nicht.</p>}
        <button className="knopf haupt gross" disabled={!gueltig || tage === 0}>
          Beantragen
        </button>
      </form>

      <h2>Meine Einträge</h2>
      {!eigene.length && <Leer>Noch keine Einträge.</Leer>}
      {eigene.map((a) => (
        <div key={a.id} className="zeile">
          <div className="wachsen">
            <strong>
              {ABWESENHEIT_TEXT[a.art]}: {datumKurz(a.von)}
              {a.bis !== a.von && ` bis ${datumKurz(a.bis)}`}
            </strong>
            {a.notiz && <div className="leise-text">{a.notiz}</div>}
          </div>
          <Marke ton={ANTRAG_STATUS[a.status].ton}>{ANTRAG_STATUS[a.status].text}</Marke>
          {a.status === 'beantragt' && a.art === 'urlaub' && (
            <button
              className="knopf klein"
              onClick={async () => {
                await loeschen('abwesenheiten', a.id);
                zeigen('Antrag zurückgezogen.');
              }}
            >
              Zurückziehen
            </button>
          )}
        </div>
      ))}
    </Seite>
  );
}
