import { useEffect, useMemo, useState } from 'react';
import { Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { useNamen, zeitpunkt } from '../../lib/ansicht';
import { istAdmin, neueId, useDaten } from '../../lib/daten';
import {
  ABWESENHEIT_TEXT, abwesenheitAm, datumKurz, feiertag, fmtStunden, heuteIso, istJugendlich, kalenderwoche, montagDerWoche, nettoStunden, planDiff, planWarnungen,
  plusTage, standardZeiten, tageDerWoche, wochentagKurz
} from '../../lib/regeln';
import type { Einsatz } from '../../lib/types';

// Der Entwurf einer Woche liegt nur auf diesem Gerät, bis er veröffentlicht wird.
// Erst beim Veröffentlichen sehen die Mitarbeiter den neuen Stand und bekommen eine Benachrichtigung.
const ENTWURF = (montag: string) => `fs-plan-entwurf:${montag}`;

function entwurfLesen(montag: string): Einsatz[] | null {
  try {
    const roh = localStorage.getItem(ENTWURF(montag));
    return roh ? (JSON.parse(roh) as Einsatz[]) : null;
  } catch {
    return null;
  }
}

function entwurfSchreiben(montag: string, liste: Einsatz[] | null) {
  try {
    if (liste) localStorage.setItem(ENTWURF(montag), JSON.stringify(liste));
    else localStorage.removeItem(ENTWURF(montag));
  } catch {
    // ohne Speicher bleibt der Entwurf nur bis zum Neuladen
  }
}

interface Zelle {
  personId: string;
  datum: string;
}

export function Wochenplan() {
  const { daten, benutzer, einstellungen, planVeroeffentlichen, online } = useDaten();
  const namen = useNamen();
  const zeigen = useHinweis();
  const darfPlanen = istAdmin(benutzer);
  const [montag, setMontag] = useState(() => montagDerWoche(new Date().getDay() >= 5 || new Date().getDay() === 0 ? plusTage(heuteIso(), 3) : heuteIso()));
  const [mitSamstag, setMitSamstag] = useState(false);
  const [zelle, setZelle] = useState<Zelle | null>(null);
  const [hinweis, setHinweis] = useState('');
  const [sendet, setSendet] = useState(false);
  const tage = tageDerWoche(montag, mitSamstag ? 6 : 5);
  const alleTage = tageDerWoche(montag, 7);

  const veroeffentlicht = useMemo(() => daten.einsaetze.filter((e) => alleTage.includes(e.datum)), [daten.einsaetze, alleTage]);
  const [entwurf, setEntwurfRoh] = useState<Einsatz[] | null>(() => entwurfLesen(montag));
  useEffect(() => setEntwurfRoh(entwurfLesen(montag)), [montag]);

  const plan = entwurf ?? veroeffentlicht;
  const aenderung = planDiff(veroeffentlicht, plan);
  const hatAenderung = aenderung.speichern.length + aenderung.loeschen.length > 0;

  function setEntwurf(liste: Einsatz[]) {
    setEntwurfRoh(liste);
    entwurfSchreiben(montag, liste);
  }

  const personen = daten.personen.filter((p) => p.imPlan && (!p.aktivBis || p.aktivBis >= montag)).sort((a, b) => a.name.localeCompare(b.name));
  const warnungen = planWarnungen(montag, personen, plan, daten.abwesenheiten);

  // Bestätigungen der zuletzt veröffentlichten Fassung dieser Woche
  const fassungen = daten.planfassungen.filter((f) => f.woche === montag).sort((a, b) => b.veroeffentlichtAm.localeCompare(a.veroeffentlichtAm));
  const letzte = fassungen[0];
  const offeneJePerson = new Map<string, boolean>();
  for (const b of daten.bestaetigungen) {
    if (!fassungen.some((f) => f.id === b.planfassungId)) continue;
    offeneJePerson.set(b.personId, (offeneJePerson.get(b.personId) ?? false) || !b.bestaetigtAm);
  }

  function vorwocheUebernehmen() {
    const vorher = daten.einsaetze.filter((e) => e.datum >= plusTage(montag, -7) && e.datum < montag);
    const neu = vorher
      .map((e) => ({ ...e, id: neueId(), datum: plusTage(e.datum, 7) }))
      .filter((e) => !feiertag(e.datum) && !abwesenheitAm(e.personId, e.datum, daten.abwesenheiten));
    const behalten = plan.filter((e) => !neu.some((n) => n.personId === e.personId && n.datum === e.datum));
    setEntwurf([...behalten, ...neu]);
    zeigen(`${neu.length} Einsätze aus der Vorwoche übernommen. Tage mit Urlaub, Schule oder Feiertag wurden ausgelassen.`);
  }

  async function veroeffentlichen() {
    setSendet(true);
    try {
      await planVeroeffentlichen(montag, aenderung, hinweis.trim());
      entwurfSchreiben(montag, null);
      setEntwurfRoh(null);
      setHinweis('');
      const andere = aenderung.betroffene.filter((id) => id !== benutzer?.id).length;
      zeigen(`Plan KW ${kalenderwoche(montag)} veröffentlicht.${andere ? ` ${andere === 1 ? 'Eine Person wird' : `${andere} Personen werden`} benachrichtigt.` : ''}`);
    } catch (e) {
      zeigen(`Veröffentlichen hat nicht geklappt: ${e instanceof Error ? e.message : 'unbekannter Fehler'}. Der Entwurf bleibt erhalten.`, { fehler: true });
    } finally {
      setSendet(false);
    }
  }

  return (
    <Seite titel="Wochenplan">
      <div className="woche-kopf">
        <button className="knopf klein" onClick={() => setMontag(plusTage(montag, -7))} aria-label="Vorige Woche">
          ‹
        </button>
        <strong>
          KW {kalenderwoche(montag)} · {datumKurz(montag)} bis {datumKurz(plusTage(montag, mitSamstag ? 5 : 4))}
        </strong>
        <button className="knopf klein" onClick={() => setMontag(plusTage(montag, 7))} aria-label="Nächste Woche">
          ›
        </button>
        <label className="haken">
          <input type="checkbox" checked={mitSamstag} onChange={(e) => setMitSamstag(e.target.checked)} /> Samstag
        </label>
        {darfPlanen && (
          <button className="knopf klein" onClick={vorwocheUebernehmen}>
            Vorwoche übernehmen
          </button>
        )}
      </div>
      {!darfPlanen && <p className="leise-text">Nur ansehen. Den Plan ändert Jannik.</p>}
      {hatAenderung && <p className="hinweistext">Entwurf: {aenderung.speichern.length + aenderung.loeschen.length} Änderungen, noch nicht veröffentlicht.</p>}

      <div className="plan-rahmen">
        <table className="plan">
          <thead>
            <tr>
              <th />
              {tage.map((t) => (
                <th key={t} className={feiertag(t) ? 'feiertag' : t === heuteIso() ? 'heute' : ''}>
                  {wochentagKurz(t)} {datumKurz(t).slice(0, 6)}
                  {feiertag(t) && <small>{feiertag(t)}</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {personen.map((p) => {
              const stunden = plan.filter((e) => e.personId === p.id && alleTage.includes(e.datum)).reduce((s, e) => s + nettoStunden(e.beginn, e.ende, istJugendlich(p, e.datum)), 0);
              return (
                <tr key={p.id}>
                  <th>
                    {p.name.split(' ')[0]}
                    {p.azubi && <small>Azubi</small>}
                    <small>{fmtStunden(stunden)} Std.</small>
                    {offeneJePerson.get(p.id) && <small className="rot-text">ungelesen</small>}
                  </th>
                  {tage.map((t) => {
                    const eigene = plan.filter((e) => e.personId === p.id && e.datum === t).sort((a, b) => a.beginn.localeCompare(b.beginn));
                    const abw = abwesenheitAm(p.id, t, daten.abwesenheiten);
                    const warn = warnungen.filter((w) => w.personId === p.id && w.datum === t);
                    return (
                      <td key={t} className={`${abw ? 'abwesend' : ''} ${warn.length ? 'warnung' : ''}`}>
                        <button className="zelle" disabled={!darfPlanen} onClick={() => setZelle({ personId: p.id, datum: t })} title={warn.map((w) => w.text).join('\n')}>
                          {abw && <span className="zelle-abw">{ABWESENHEIT_TEXT[abw.art]}</span>}
                          {eigene.map((e) => (
                            <span key={e.id} className="zelle-einsatz">
                              {namen.baustelle(e.baustelleId)}
                              <small>
                                {e.beginn} bis {e.ende}
                              </small>
                            </span>
                          ))}
                          {!abw && !eigene.length && darfPlanen && <span className="zelle-leer">+</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {warnungen.length > 0 && (
        <section>
          <h2>Bitte prüfen</h2>
          <ul className="warnliste">
            {warnungen.map((w, i) => (
              <li key={i}>
                <strong>{namen.person(w.personId).split(' ')[0]}</strong>
                {w.datum ? `, ${wochentagKurz(w.datum)} ${datumKurz(w.datum).slice(0, 6)}` : ''}: {w.text}
              </li>
            ))}
          </ul>
          <p className="leise-text">Die App warnt nur. Ob es so passt, entscheidest du. Die Regeln zum Jugendarbeitsschutz sind vereinfacht.</p>
        </section>
      )}

      {darfPlanen && hatAenderung && (
        <section className="karte stapel">
          <h2>Veröffentlichen</h2>
          <p>Benachrichtigt werden: {aenderung.betroffene.map((id) => namen.person(id)).join(', ')}. Sie müssen den Plan als gelesen bestätigen.</p>
          <input value={hinweis} onChange={(e) => setHinweis(e.target.value)} placeholder="Hinweis an alle (freiwillig), zum Beispiel Mittwoch Gerüstabnahme" />
          <div className="knopfreihe">
            <button className="knopf haupt gross" disabled={sendet || !online} onClick={veroeffentlichen}>
              {sendet ? 'Wird veröffentlicht' : 'Veröffentlichen'}
            </button>
            <button
              className="knopf"
              onClick={() => {
                entwurfSchreiben(montag, null);
                setEntwurfRoh(null);
              }}
            >
              Entwurf verwerfen
            </button>
          </div>
          {!online && <p className="fehlertext">Zum Veröffentlichen wird Netz gebraucht.</p>}
        </section>
      )}

      {letzte && (
        <section>
          <h2>Gelesen</h2>
          <p className="leise-text">Zuletzt veröffentlicht {zeitpunkt(letzte.veroeffentlichtAm)}.</p>
          <div className="marken">
            {[...offeneJePerson.entries()].map(([id, offen]) => (
              <Marke key={id} ton={offen ? 'rot' : 'gruen'}>
                {namen.person(id).split(' ')[0]}: {offen ? 'noch nicht gelesen' : 'gelesen'}
              </Marke>
            ))}
          </div>
        </section>
      )}

      {zelle && (
        <ZellenEditor
          zelle={zelle}
          plan={plan}
          onPlan={setEntwurf}
          onSchliessen={() => setZelle(null)}
          standard={standardZeiten(zelle.datum, einstellungen)}
        />
      )}
    </Seite>
  );
}

function ZellenEditor({
  zelle, plan, onPlan, onSchliessen, standard
}: {
  zelle: Zelle;
  plan: Einsatz[];
  onPlan: (liste: Einsatz[]) => void;
  onSchliessen: () => void;
  standard: { beginn: string; ende: string };
}) {
  const { daten } = useDaten();
  const namen = useNamen();
  const eigene = plan.filter((e) => e.personId === zelle.personId && e.datum === zelle.datum);
  const abw = abwesenheitAm(zelle.personId, zelle.datum, daten.abwesenheiten);
  const baustellen = daten.baustellen.filter((b) => b.status !== 'abgeschlossen').sort((a, b) => a.name.localeCompare(b.name));
  const vortag = plan.filter((e) => e.personId === zelle.personId && e.datum === plusTage(zelle.datum, -1));

  function aendern(id: string, teil: Partial<Einsatz>) {
    onPlan(plan.map((e) => (e.id === id ? { ...e, ...teil } : e)));
  }

  function dazu(baustelleId: string) {
    const b = daten.baustellen.find((x) => x.id === baustelleId);
    onPlan([...plan, { id: neueId(), personId: zelle.personId, baustelleId, datum: zelle.datum, beginn: b?.arbeitsbeginn || standard.beginn, ende: standard.ende, notiz: '' }]);
  }

  return (
    <div className="dialog-hintergrund" onClick={onSchliessen}>
      <div className="dialog" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2>
          {namen.person(zelle.personId)}, {wochentagKurz(zelle.datum)} {datumKurz(zelle.datum)}
        </h2>
        {abw && <p className="hinweistext">Eingetragen: {ABWESENHEIT_TEXT[abw.art]}</p>}
        {eigene.map((e) => (
          <div key={e.id} className="karte stapel">
            <select value={e.baustelleId} onChange={(x) => aendern(e.id, { baustelleId: x.target.value })}>
              {baustellen.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="knopfreihe">
              <label>
                Von <input type="time" value={e.beginn} onChange={(x) => aendern(e.id, { beginn: x.target.value })} />
              </label>
              <label>
                Bis <input type="time" value={e.ende} onChange={(x) => aendern(e.id, { ende: x.target.value })} />
              </label>
            </div>
            <input value={e.notiz} onChange={(x) => aendern(e.id, { notiz: x.target.value })} placeholder="Notiz für den Tag (freiwillig)" />
            <button className="knopf klein" onClick={() => onPlan(plan.filter((x) => x.id !== e.id))}>
              Entfernen
            </button>
          </div>
        ))}
        <h3>{eigene.length ? 'Weitere Baustelle' : 'Baustelle wählen'}</h3>
        <div className="wahl">
          {baustellen.map((b) => (
            <button key={b.id} onClick={() => dazu(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
        {vortag.length > 0 && !eigene.length && (
          <button
            className="knopf"
            onClick={() =>
              // Freitag endet früher, deshalb dort die Standardzeit statt der vom Donnerstag
              onPlan([...plan, ...vortag.map((e) => ({ ...e, id: neueId(), datum: zelle.datum, ende: wochentagKurz(zelle.datum) === 'Fr' ? standard.ende : e.ende }))])
            }
          >
            Wie am Vortag
          </button>
        )}
        <button className="knopf haupt gross" onClick={onSchliessen}>
          Fertig
        </button>
      </div>
    </div>
  );
}
