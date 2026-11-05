import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JaNein, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { neueId, useDaten } from '../../lib/daten';
import { adresse } from '../../lib/regeln';
import { csvLesen, FELDER, zeilenUmwandeln, zuordnungRaten, type Feld, type Zuordnung } from '../../lib/winworker';

// Windows-Programme speichern CSV oft nicht als UTF-8. Dann stimmen Umlaute erst mit Windows-1252.
async function textLesen(datei: File): Promise<string> {
  const bytes = await datei.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
}

export function WinworkerImport() {
  const { daten, speichern } = useDaten();
  const zeigen = useHinweis();
  const navigate = useNavigate();
  const [zeilen, setZeilen] = useState<string[][] | null>(null);
  const [zuordnung, setZuordnung] = useState<Zuordnung>({});
  const [mitKopf, setMitKopf] = useState(true);
  const [laeuft, setLaeuft] = useState(false);

  async function dateiGewaehlt(datei: File) {
    if (/\.(xlsx?|pdf)$/i.test(datei.name)) {
      zeigen('Bitte als CSV speichern. In Excel: Datei, Speichern unter, Dateityp „CSV (Trennzeichen-getrennt)“.', { fehler: true });
      return;
    }
    const z = csvLesen(await textLesen(datei));
    setZeilen(z);
    setZuordnung(zuordnungRaten(z[0] ?? []));
  }

  const kopf = zeilen?.[0] ?? [];
  const tabelle = zeilen ? (mitKopf ? zeilen.slice(1) : zeilen) : [];
  const ergebnis = zeilenUmwandeln(tabelle, zuordnung, neueId);
  const vorhandeneNr = new Set(daten.baustellen.map((b) => b.winworkerNr).filter(Boolean));
  const neu = ergebnis.filter((e) => !e.baustelle.winworkerNr || !vorhandeneNr.has(e.baustelle.winworkerNr));
  const doppelt = ergebnis.length - neu.length;

  async function uebernehmen() {
    setLaeuft(true);
    for (const e of neu) {
      await speichern('baustellen', e.baustelle);
      if (e.kontakt) await speichern('kontakte', e.kontakt);
    }
    setLaeuft(false);
    zeigen(`${neu.length} Baustellen übernommen.`);
    navigate('/buero/baustellen');
  }

  return (
    <Seite titel="Aus WinWorker übernehmen" zurueck="/buero/baustellen">
      <div className="karte stapel">
        <p>
          In WinWorker die Projektliste mit Adressen als CSV oder Excel exportieren. Eine Excel-Datei vorher in Excel über „Speichern unter“ als CSV sichern. PDF geht nicht, weil sich daraus die
          Spalten nicht sicher lesen lassen.
        </p>
        <input type="file" accept=".csv,text/csv,.txt" onChange={(e) => e.target.files?.[0] && void dateiGewaehlt(e.target.files[0])} />
      </div>

      {zeilen && (
        <>
          <section>
            <h2>Spalten zuordnen</h2>
            <JaNein wert={mitKopf} onChange={setMitKopf} text="Erste Zeile enthält Überschriften" />
            <div className="formular zuordnung">
              {FELDER.map(({ feld, text }) => (
                <label key={feld}>
                  {text}
                  <select
                    value={zuordnung[feld] ?? ''}
                    onChange={(e) => setZuordnung({ ...zuordnung, [feld as Feld]: e.target.value === '' ? undefined : Number(e.target.value) })}
                  >
                    <option value="">nicht vorhanden</option>
                    {kopf.map((k, i) => (
                      <option key={i} value={i}>
                        {mitKopf ? k || `Spalte ${i + 1}` : `Spalte ${i + 1}: ${k}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="leise-text">Ist eine Objektadresse vorhanden, wird sie als Baustellenadresse genommen, sonst die Kundenadresse. Vierstellige PLZ bekommen die fehlende Null.</p>
          </section>

          <section>
            <h2>Vorschau</h2>
            <p>
              {neu.length} neue Baustellen
              {doppelt > 0 && `, ${doppelt} schon vorhanden (gleiche WinWorker-Nummer, werden übersprungen)`}.
            </p>
            {neu.slice(0, 8).map((e) => (
              <div key={e.baustelle.id} className="zeile">
                <div className="wachsen">
                  <strong>{e.baustelle.name}</strong>
                  <div className="leise-text">{[e.baustelle.winworkerNr, e.baustelle.kunde, adresse(e.baustelle), e.kontakt?.telefon].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
            {neu.length > 8 && <p className="leise-text">und {neu.length - 8} weitere</p>}
            <button className="knopf haupt gross" disabled={!neu.length || laeuft} onClick={uebernehmen}>
              {laeuft ? 'Wird übernommen' : `${neu.length} Baustellen übernehmen`}
            </button>
          </section>
        </>
      )}
    </Seite>
  );
}
