import { Fragment, useState } from 'react';
import { Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { useNamen } from '../../lib/ansicht';
import { istAdmin, useDaten } from '../../lib/daten';
import { herunterladen } from '../../lib/pdf';
import { datumKurz, heuteIso, kalenderwoche, montagDerWoche, plusTage, tageDerWoche, wochentagKurz } from '../../lib/regeln';
import { alsDauer, ausStunden, excelDatei, exportZeilen, sollEintragen, stundeNettoMin, stundenAm, tagPruefen } from '../../lib/stunden';
import type { Person, Stunde } from '../../lib/types';

interface Tag {
  person: Person;
  datum: string;
  eintraege: Stunde[];
  fehler: string[];
  abweichung: string[];
  fehlt: boolean;
}

export function Stunden() {
  const { daten, benutzer, speichern } = useDaten();
  const namen = useNamen();
  const zeigen = useHinweis();
  const admin = istAdmin(benutzer);
  const heute = heuteIso();
  const [montag, setMontag] = useState(montagDerWoche(heute));
  const [laeuft, setLaeuft] = useState(false);
  const woche = tageDerWoche(montag, 7);

  const personen = daten.personen
    .filter((p) => p.imPlan || daten.stunden.some((s) => s.personId === p.id && woche.includes(s.datum)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const tageJePerson = personen.map((p) => {
    const tage: Tag[] = [];
    for (const d of woche) {
      const eintraege = stundenAm(daten.stunden, p.id, d);
      const soll = d <= heute && sollEintragen(p, d, daten.einsaetze, daten.abwesenheiten);
      if (!eintraege.length && !soll) continue;
      const pr = eintraege.length ? tagPruefen(p, d, ausStunden(eintraege), daten.stunden, daten.einsaetze) : { fehler: [], abweichung: [] };
      tage.push({ person: p, datum: d, eintraege, ...pr, fehlt: !eintraege.length });
    }
    const summe = tage.flatMap((t) => t.eintraege).reduce((n, s) => n + stundeNettoMin(s), 0);
    return { person: p, tage, summe };
  });

  const alleTage = tageJePerson.flatMap((x) => x.tage);
  const offen = alleTage.filter((t) => t.eintraege.some((s) => s.status === 'offen'));
  const ohneHinweis = offen.filter((t) => !t.fehler.length);
  const freigegeben = alleTage.flatMap((t) => t.eintraege).filter((s) => s.status === 'freigegeben');
  const fehlend = alleTage.filter((t) => t.fehlt).length;

  async function setzen(tage: Tag[], status: Stunde['status']) {
    const jetzt = new Date().toISOString();
    for (const t of tage)
      for (const s of t.eintraege) if (s.status !== status) await speichern('stunden', { ...s, status, freigegebenAm: status === 'freigegeben' ? jetzt : null });
  }

  async function exportieren() {
    if (!freigegeben.length) return;
    setLaeuft(true);
    try {
      const blob = await excelDatei(exportZeilen(freigegeben, daten.personen, daten.baustellen), `KW ${kalenderwoche(montag)}`);
      herunterladen(blob, `Stunden KW ${kalenderwoche(montag)} ${montag.slice(0, 4)}.xlsx`);
      const jetzt = new Date().toISOString();
      for (const s of freigegeben) await speichern('stunden', { ...s, exportiertAm: jetzt });
      zeigen(`${freigegeben.length} Zeilen exportiert.`);
    } finally {
      setLaeuft(false);
    }
  }

  const schonExportiert = freigegeben.filter((s) => s.exportiertAm).length;
  // WinWorker braucht je Zeile den Mitarbeiter-Index und eine Projektnummer
  const ohneIndex = [...new Set(freigegeben.map((s) => s.personId))]
    .map((id) => daten.personen.find((p) => p.id === id))
    .filter((p) => p && !p.winworkerNr?.trim())
    .map((p) => p!.name);
  const ohneProjekt = freigegeben.filter((s) => !daten.baustellen.find((b) => b.id === s.baustelleId)?.winworkerNr?.trim()).length;

  return (
    <Seite titel="Stunden">
      <div className="knopfreihe">
        <button className="knopf" onClick={() => setMontag(plusTage(montag, -7))} aria-label="Woche davor">
          ‹
        </button>
        <strong>
          KW {kalenderwoche(montag)} · {datumKurz(montag)} bis {datumKurz(plusTage(montag, 6))}
        </strong>
        <button className="knopf" onClick={() => setMontag(plusTage(montag, 7))} aria-label="Woche danach">
          ›
        </button>
      </div>

      <div className="karte zahlen">
        <div>
          <strong>{offen.length}</strong> Tage zu prüfen
        </div>
        <div>
          <strong>{offen.length - ohneHinweis.length}</strong> mit Hinweis
        </div>
        <div>
          <strong>{fehlend}</strong> fehlen noch
        </div>
        <div>
          <strong>{freigegeben.length}</strong> Zeilen freigegeben
        </div>
      </div>

      {admin ? (
        <div className="knopfreihe">
          <button className="knopf" disabled={!ohneHinweis.length} onClick={() => void setzen(ohneHinweis, 'freigegeben').then(() => zeigen(`${ohneHinweis.length} Tage freigegeben.`))}>
            Alle ohne Hinweis freigeben ({ohneHinweis.length})
          </button>
          <button className="knopf haupt" disabled={!freigegeben.length || laeuft} onClick={exportieren}>
            Excel für WinWorker herunterladen
          </button>
          {freigegeben.length > 0 && (
            <span className="leise-text">
              {freigegeben.length} freigegebene Zeilen{schonExportiert ? `, davon ${schonExportiert} schon einmal exportiert` : ''}.
            </span>
          )}
        </div>
      ) : (
        <p className="leise-text">Freigeben und exportieren kann Jannik.</p>
      )}
      {admin && (ohneIndex.length > 0 || ohneProjekt > 0) && (
        <ul className="warnliste warn-gelb">
          {ohneIndex.length > 0 && <li>Ohne Mitarbeiter-Index für WinWorker: {ohneIndex.join(', ')}. Bitte unter Personen eintragen.</li>}
          {ohneProjekt > 0 && <li>{ohneProjekt} freigegebene Zeilen ohne WinWorker-Projektnummer (Werkstatt oder Baustelle ohne Nummer). WinWorker lässt diese Zeilen aus, solange „Zeilen ohne Projekt“ nicht angehakt ist.</li>}
        </ul>
      )}

      <div className="tabelle-rahmen">
        <table className="stunden-tabelle">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Baustelle</th>
              <th>Zeit</th>
              <th className="rechts">Pause</th>
              <th className="rechts">Std.</th>
              <th>Prüfung</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tageJePerson.map(({ person, tage, summe }) => (
              <Fragment key={person.id}>
                <tr className="person-kopf">
                  <td colSpan={4}>{person.name}</td>
                  <td className="rechts">{alsDauer(summe)}</td>
                  <td colSpan={2}></td>
                </tr>
                {!tage.length && (
                  <tr>
                    <td colSpan={7} className="leise-text">
                      Keine Tage in dieser Woche.
                    </td>
                  </tr>
                )}
                {tage.map((t) => {
                  const frei = t.eintraege.length > 0 && t.eintraege.every((s) => s.status === 'freigegeben');
                  const zeilen = t.fehlt ? [null] : t.eintraege;
                  return zeilen.map((s, i) => (
                    <tr key={`${t.datum}-${s?.id ?? 'fehlt'}`}>
                      <td>{i === 0 && `${wochentagKurz(t.datum)} ${datumKurz(t.datum)}`}</td>
                      <td>{s ? (s.baustelleId ? namen.baustelle(s.baustelleId) : 'Werkstatt / Lager') : '–'}</td>
                      <td>{s ? `${s.beginn} bis ${s.ende}` : ''}</td>
                      <td className="rechts">{s ? `${s.pauseMin} min` : ''}</td>
                      <td className="rechts">{s ? alsDauer(stundeNettoMin(s)) : ''}</td>
                      <td>
                        {i === 0 &&
                          (t.fehlt ? (
                            <Marke ton="rot">fehlt noch</Marke>
                          ) : (
                            <div className="stapel eng">
                              {t.fehler.map((f) => (
                                <Marke key={f} ton="gelb">
                                  {f}
                                </Marke>
                              ))}
                              {t.abweichung.map((f) => (
                                <Marke key={f} ton="grau">
                                  {f}
                                </Marke>
                              ))}
                              {!t.fehler.length && !t.abweichung.length && <Marke ton="gruen">passt</Marke>}
                            </div>
                          ))}
                      </td>
                      <td>
                        {i === 0 && !t.fehlt && (frei ? (
                          admin ? (
                            <button className="knopf klein flach" onClick={() => void setzen([t], 'offen')}>
                              Freigabe zurücknehmen
                            </button>
                          ) : (
                            <Marke ton="gruen">freigegeben</Marke>
                          )
                        ) : admin ? (
                          <button className="knopf klein" onClick={() => void setzen([t], 'freigegeben')}>
                            Freigeben
                          </button>
                        ) : (
                          <Marke ton="blau">offen</Marke>
                        ))}
                      </td>
                    </tr>
                  ));
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="leise-text">
        Die Excel-Datei enthält alle freigegebenen Stunden dieser Woche. Die Spalten A bis I passen zur Importkonfiguration in WinWorker, ab Spalte J stehen nur Angaben zur Kontrolle.
      </p>
    </Seite>
  );
}
