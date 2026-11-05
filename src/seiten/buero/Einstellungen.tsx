import { useState } from 'react';
import { JaNein, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { dateiBlob, useDaten } from '../../lib/daten';
import { herunterladen } from '../../lib/pdf';
import { heuteIso } from '../../lib/regeln';
import { TABELLEN } from '../../lib/types';

export function Einstellungen() {
  const { daten, einstellungen, speichern } = useDaten();
  const zeigen = useHinweis();
  const [e, setE] = useState(einstellungen);
  const [mitDateien, setMitDateien] = useState(true);
  const [fortschritt, setFortschritt] = useState<string | null>(null);

  const zeit = (k: keyof typeof e, text: string) => (
    <label>
      {text}
      <input type="time" value={e[k]} onChange={(x) => setE({ ...e, [k]: x.target.value })} />
    </label>
  );

  // Alles in eine ZIP-Datei: Tabellen als JSON, auf Wunsch mit allen Fotos, Lieferscheinen und Dokumenten.
  // Empfehlung: einmal im Monat herunterladen und auf dem Büroserver ablegen.
  async function sicherung() {
    const { zipSync, strToU8 } = await import('fflate');
    const inhalt: Record<string, Uint8Array> = {};
    for (const t of TABELLEN) inhalt[`tabellen/${t}.json`] = strToU8(JSON.stringify(daten[t], null, 2));
    if (mitDateien) {
      const pfade = [
        ...daten.fotos.map((f) => f.pfad),
        ...daten.lieferscheine.flatMap((l) => l.seiten),
        ...daten.meldungen.map((m) => m.fotoPfad).filter(Boolean),
        ...daten.dokumente.map((d) => d.pfad)
      ] as string[];
      let fehlend = 0;
      for (const [i, pfad] of pfade.entries()) {
        setFortschritt(`Datei ${i + 1} von ${pfade.length}`);
        try {
          inhalt[`dateien/${pfad}`] = new Uint8Array(await (await dateiBlob(pfad)).arrayBuffer());
        } catch {
          fehlend++;
        }
      }
      if (fehlend) zeigen(`${fehlend} Dateien konnten nicht geladen werden und fehlen in der Sicherung.`, { fehler: true });
    }
    setFortschritt('ZIP wird gepackt');
    const zip = zipSync(inhalt, { level: 0 });
    herunterladen(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), `Frohes Schaffen Sicherung ${heuteIso()}.zip`);
    setFortschritt(null);
  }

  return (
    <Seite titel="Einstellungen">
      <section className="karte formular">
        <h2>Arbeitszeit (Vorschlag im Plan)</h2>
        <div className="zwei">
          {zeit('beginn', 'Beginn')}
          {zeit('ende', 'Ende Montag bis Donnerstag')}
        </div>
        {zeit('endeFreitag', 'Ende Freitag')}
        <h2>Benachrichtigungen</h2>
        <p className="leise-text">Nur Montag bis Freitag. Was außerhalb dieser Zeit passiert, kommt am nächsten Arbeitstag zu Beginn.</p>
        <div className="zwei">
          {zeit('pushVon', 'Frühestens ab')}
          {zeit('pushBis', 'Spätestens bis')}
        </div>
        <button
          className="knopf haupt"
          onClick={async () => {
            await speichern('einstellungen', e);
            zeigen('Gespeichert.');
          }}
        >
          Speichern
        </button>
      </section>

      <section className="karte stapel">
        <h2>Sicherung</h2>
        <p>Lädt alle Daten als ZIP-Datei herunter. Am besten einmal im Monat auf dem Büroserver ablegen.</p>
        <JaNein wert={mitDateien} onChange={setMitDateien} text="Mit Fotos, Lieferscheinen und Dokumenten (dauert länger)" />
        <button className="knopf" disabled={Boolean(fortschritt)} onClick={sicherung}>
          {fortschritt ?? 'Sicherung herunterladen'}
        </button>
      </section>
    </Seite>
  );
}
