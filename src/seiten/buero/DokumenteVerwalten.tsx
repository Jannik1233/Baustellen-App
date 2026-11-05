import { useState } from 'react';
import { JaNein, Leer, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { useNamen } from '../../lib/ansicht';
import { istAdmin, neueId, useDaten } from '../../lib/daten';
import type { Dokument, DokumentKategorie } from '../../lib/types';
import { DokumentZeile, KATEGORIE_TEXT } from '../Dokumente';

// Grenze, damit der kostenlose Speicher (1 GB) lange reicht. Große Pläne vorher als PDF verkleinern.
const MAX_MB = 20;

export function DokumenteVerwalten() {
  const { daten, benutzer, speichern, loeschen, dateiSpeichern } = useDaten();
  const namen = useNamen();
  const zeigen = useHinweis();
  const admin = istAdmin(benutzer);
  const [datei, setDatei] = useState<File | null>(null);
  const [titel, setTitel] = useState('');
  const [kategorie, setKategorie] = useState<DokumentKategorie>('sicherheitsdatenblatt');
  const [baustelle, setBaustelle] = useState('');
  const [offline, setOffline] = useState(false);

  async function hochladen(e: React.FormEvent) {
    e.preventDefault();
    if (!datei) return;
    if (datei.size > MAX_MB * 1024 * 1024) return zeigen(`Die Datei ist größer als ${MAX_MB} MB. Bitte vorher verkleinern.`, { fehler: true });
    const id = neueId();
    const endung = datei.name.includes('.') ? datei.name.split('.').pop()!.toLowerCase() : 'bin';
    const pfad = `dokument/${id}.${endung}`;
    await dateiSpeichern(pfad, datei);
    const dok: Dokument = {
      id,
      baustelleId: baustelle || null,
      kategorie,
      titel: titel.trim() || datei.name.replace(/\.[^.]+$/, ''),
      pfad,
      dateiname: datei.name,
      offline,
      hochgeladenAm: new Date().toISOString()
    };
    await speichern('dokumente', dok);
    setDatei(null);
    setTitel('');
    zeigen('Dokument hochgeladen.');
  }

  const gruppen = new Map<string, Dokument[]>();
  for (const d of [...daten.dokumente].sort((a, b) => a.titel.localeCompare(b.titel))) {
    const k = d.baustelleId ?? '';
    gruppen.set(k, [...(gruppen.get(k) ?? []), d]);
  }

  return (
    <Seite titel="Dokumente verwalten">
      {admin && (
        <form className="karte formular" onSubmit={hochladen}>
          <h2>Hochladen</h2>
          <input
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setDatei(f);
              if (f && !titel) setTitel(f.name.replace(/\.[^.]+$/, ''));
            }}
          />
          <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel, so wie ihn die Mitarbeiter sehen" />
          <div className="zwei">
            <select value={kategorie} onChange={(e) => setKategorie(e.target.value as DokumentKategorie)}>
              {(Object.keys(KATEGORIE_TEXT) as DokumentKategorie[]).map((k) => (
                <option key={k} value={k}>
                  {KATEGORIE_TEXT[k]}
                </option>
              ))}
            </select>
            <select value={baustelle} onChange={(e) => setBaustelle(e.target.value)}>
              <option value="">Allgemein (für alle)</option>
              {daten.baustellen
                .filter((b) => b.status !== 'abgeschlossen')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>
          <JaNein wert={offline} onChange={setOffline} text="Auf allen Handys vorhalten, damit es auch ohne Netz aufgeht (zum Beispiel Betriebsanweisungen)" />
          <button className="knopf haupt" disabled={!datei}>
            Hochladen
          </button>
        </form>
      )}

      {!daten.dokumente.length && <Leer>Noch keine Dokumente.</Leer>}
      {[...gruppen.entries()].map(([id, liste]) => (
        <section key={id || 'allgemein'}>
          <h2>{id ? namen.baustelle(id) : 'Allgemein'}</h2>
          {liste.map((d) => (
            <DokumentZeile
              key={d.id}
              dokument={d}
              aktion={
                admin && (
                  <>
                    <button className="knopf klein" onClick={() => void speichern('dokumente', { ...d, offline: !d.offline })}>
                      {d.offline ? 'Nicht mehr vorhalten' : 'Offline vorhalten'}
                    </button>
                    <button className="knopf klein flach" onClick={() => window.confirm(`„${d.titel}“ löschen?`) && void loeschen('dokumente', d.id)}>
                      Löschen
                    </button>
                  </>
                )
              }
            />
          ))}
        </section>
      ))}
    </Seite>
  );
}
