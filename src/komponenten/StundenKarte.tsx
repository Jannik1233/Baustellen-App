import { useMemo, useState } from 'react';
import { Marke } from './Bausteine';
import { useHinweis } from './Hinweis';
import { useNamen } from '../lib/ansicht';
import { neueId, useDaten, useSichtbareBaustellen } from '../lib/daten';
import { datumKurz, wochentag } from '../lib/regeln';
import {
  alsDauer, alsUhrzeit, ausStunden, minuten, nettoMin, stundenAm, tagPruefen, vorschlag, zeilenAusZettel, type Tageszettel
} from '../lib/stunden';

const SCHRITT = 15;

// Tageszettel als Karte: zeigt den Vorschlag aus dem Plan, ein Tipp trägt ihn ein, „Ändern“ passt ihn an.
export function StundenKarte({ datum, titel }: { datum: string; titel?: string }) {
  const { daten, benutzer, einstellungen, speichern, loeschen } = useDaten();
  const baustellen = useSichtbareBaustellen();
  const namen = useNamen();
  const zeigen = useHinweis();
  const vorhanden = useMemo(() => (benutzer ? stundenAm(daten.stunden, benutzer.id, datum) : []), [daten.stunden, benutzer, datum]);
  const [entwurf, setEntwurf] = useState<Tageszettel | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (!benutzer) return null;

  const eingetragen = vorhanden.length > 0;
  const freigegeben = eingetragen && vorhanden.every((s) => s.status === 'freigegeben');
  const anzeige = entwurf ?? (eingetragen ? ausStunden(vorhanden) : vorschlag(benutzer.id, datum, daten.einsaetze, einstellungen));
  const pruefung = tagPruefen(benutzer, datum, anzeige, daten.stunden, daten.einsaetze);
  const ohneBaustelle = anzeige.abschnitte.some((a) => !a.baustelleId) && baustellen.length > 0;

  function aendern(f: (z: Tageszettel) => Tageszettel) {
    setEntwurf(f(structuredClone(anzeige)));
  }
  const verschieben = (i: number, feld: 'beginn' | 'ende', d: number) =>
    aendern((z) => {
      z.abschnitte[i][feld] = alsUhrzeit(minuten(z.abschnitte[i][feld]) + d);
      // Beim Wechsel der Baustelle grenzen die Abschnitte aneinander
      if (feld === 'ende' && z.abschnitte[i + 1]) z.abschnitte[i + 1].beginn = z.abschnitte[i].ende;
      if (feld === 'beginn' && z.abschnitte[i - 1]) z.abschnitte[i - 1].ende = z.abschnitte[i].beginn;
      return z;
    });

  function zweiteBaustelle() {
    aendern((z) => {
      const letzter = z.abschnitte[z.abschnitte.length - 1];
      const mitte = alsUhrzeit(Math.round((minuten(letzter.beginn) + minuten(letzter.ende)) / 2 / SCHRITT) * SCHRITT);
      z.abschnitte.push({ id: null, baustelleId: null, beginn: mitte, ende: letzter.ende });
      letzter.ende = mitte;
      return z;
    });
  }

  function entfernen(i: number) {
    aendern((z) => {
      const [weg] = z.abschnitte.splice(i, 1);
      if (z.abschnitte[i - 1]) z.abschnitte[i - 1].ende = weg.ende;
      else if (z.abschnitte[0]) z.abschnitte[0].beginn = weg.beginn;
      return z;
    });
  }

  async function eintragen() {
    if (!benutzer) return;
    setLaeuft(true);
    try {
      const { speichern: neu, loeschen: weg } = zeilenAusZettel(anzeige, benutzer.id, datum, vorhanden, neueId);
      for (const s of neu) await speichern('stunden', s);
      for (const id of weg) await loeschen('stunden', id);
      setEntwurf(null);
      zeigen(`Eingetragen: ${alsDauer(nettoMin(anzeige))} Stunden.`);
    } finally {
      setLaeuft(false);
    }
  }

  const bearbeiten = entwurf !== null;
  const status = freigegeben ? <Marke ton="gruen">freigegeben</Marke> : eingetragen ? <Marke ton="blau">eingetragen</Marke> : <Marke ton="gelb">offen</Marke>;

  return (
    <div className={`karte stunden-karte${!eingetragen && !bearbeiten ? ' hervor' : ''}`}>
      <div className="zeile-kopf">
        <span className="leise-text">{titel ?? `${wochentag(datum)}, ${datumKurz(datum)}`}</span>
        {status}
      </div>

      {!bearbeiten && (
        <div className="stapel eng">
          {anzeige.abschnitte.map((a, i) => (
            <div key={i}>
              <strong>{a.baustelleId ? namen.baustelle(a.baustelleId) : 'Werkstatt / Lager'}</strong>
              <div>
                {a.beginn} bis {a.ende}
                {i === 0 && ` · Pause ${anzeige.pauseMin} min`}
              </div>
            </div>
          ))}
          <div className="stunden-summe">{alsDauer(nettoMin(anzeige))} Std.</div>
        </div>
      )}

      {bearbeiten && (
        <div className="stapel">
          {anzeige.abschnitte.map((a, i) => (
            <div key={i} className="stapel eng abschnitt">
              <label className="feld-klein">
                {anzeige.abschnitte.length > 1 ? `Baustelle ${i + 1}` : 'Baustelle'}
                <select
                  value={a.baustelleId ?? ''}
                  onChange={(e) => aendern((z) => ((z.abschnitte[i].baustelleId = e.target.value || null), z))}
                >
                  <option value="">Werkstatt / Lager</option>
                  {baustellen.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <Stepper text="Beginn" wert={a.beginn} minus={() => verschieben(i, 'beginn', -SCHRITT)} plus={() => verschieben(i, 'beginn', SCHRITT)} />
              <Stepper text="Ende" wert={a.ende} minus={() => verschieben(i, 'ende', -SCHRITT)} plus={() => verschieben(i, 'ende', SCHRITT)} />
              {anzeige.abschnitte.length > 1 && (
                <button className="knopf flach klein" onClick={() => entfernen(i)}>
                  Diese Baustelle entfernen
                </button>
              )}
            </div>
          ))}
          <Stepper
            text="Pause"
            wert={`${anzeige.pauseMin} min`}
            minus={() => aendern((z) => ((z.pauseMin = Math.max(0, z.pauseMin - SCHRITT)), z))}
            plus={() => aendern((z) => ((z.pauseMin += SCHRITT), z))}
          />
          {anzeige.abschnitte.length < 3 && (
            <button className="knopf" onClick={zweiteBaustelle}>
              {anzeige.abschnitte.length === 1 ? 'Zweite Baustelle am selben Tag' : 'Weitere Baustelle'}
            </button>
          )}
          <div className="stunden-summe">{alsDauer(nettoMin(anzeige))} Std.</div>
        </div>
      )}

      {!freigegeben && pruefung.fehler.length > 0 && (
        <ul className="warnliste warn-gelb">
          {pruefung.fehler.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {!freigegeben && !pruefung.fehler.length && ohneBaustelle && !eingetragen && (
        <p className="leise-text">Keine Baustelle im Plan. Falls du auf einer Baustelle warst, tippe auf „Ändern“.</p>
      )}

      {freigegeben ? (
        <p className="leise-text">Vom Büro freigegeben. Änderungen bitte direkt bei Jannik melden.</p>
      ) : (
        <div className="knopfreihe">
          {(!eingetragen || bearbeiten) && (
            <button className="knopf haupt" disabled={laeuft} onClick={eintragen}>
              {bearbeiten ? 'So eintragen' : 'Stimmt so'}
            </button>
          )}
          {bearbeiten ? (
            <button className="knopf flach" onClick={() => setEntwurf(null)}>
              Abbrechen
            </button>
          ) : (
            <button className="knopf" onClick={() => setEntwurf(structuredClone(anzeige))}>
              Ändern
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ text, wert, minus, plus }: { text: string; wert: string; minus: () => void; plus: () => void }) {
  return (
    <div className="stepper">
      <span className="leise-text">{text}</span>
      <button className="knopf" onClick={minus} aria-label={`${text} 15 Minuten weniger`}>
        −
      </button>
      <output>{wert}</output>
      <button className="knopf" onClick={plus} aria-label={`${text} 15 Minuten mehr`}>
        +
      </button>
    </div>
  );
}
