import { useState } from 'react';
import { DateiBild, Leer, Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { useNamen, zeitpunkt } from '../../lib/ansicht';
import { dateiBlob, useDaten } from '../../lib/daten';
import { herunterladen, lieferscheinPdf } from '../../lib/pdf';
import { datumKurz, heuteIso } from '../../lib/regeln';
import type { Lieferschein, LieferscheinStatus } from '../../lib/types';
import { LIEFERSCHEIN_STATUS } from '../MeineMeldungen';

type Filter = LieferscheinStatus | 'alle';

export function Lieferscheine() {
  const { daten, speichern } = useDaten();
  const namen = useNamen();
  const zeigen = useHinweis();
  const [filter, setFilter] = useState<Filter>('offen');
  const [baustelle, setBaustelle] = useState('');
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [pdfLaeuft, setPdfLaeuft] = useState(false);

  const liste = daten.lieferscheine
    .filter((l) => filter === 'alle' || l.status === filter)
    .filter((l) => !baustelle || (baustelle === 'ohne' ? !l.baustelleId : l.baustelleId === baustelle))
    .sort((a, b) => b.erfasstAm.localeCompare(a.erfasstAm));

  const status = (l: Lieferschein, s: LieferscheinStatus) => void speichern('lieferscheine', { ...l, status: s });

  async function pdf() {
    const auswahl = liste.filter((l) => gewaehlt.size === 0 || gewaehlt.has(l.id));
    setPdfLaeuft(true);
    try {
      const seiten = [];
      for (const l of auswahl)
        for (const [i, pfad] of l.seiten.entries())
          seiten.push({
            ueberschrift: `${namen.baustelle(l.baustelleId)} · ${datumKurz(l.datum)}${l.lieferant ? ` · ${l.lieferant}` : ''} · Seite ${i + 1} von ${l.seiten.length}`,
            bild: await dateiBlob(pfad)
          });
      herunterladen(await lieferscheinPdf(seiten), `Lieferscheine ${heuteIso()}.pdf`);
    } catch {
      zeigen('Das PDF konnte nicht erstellt werden. Sind alle Bilder schon hochgeladen?', { fehler: true });
    } finally {
      setPdfLaeuft(false);
    }
  }

  const baustellenMitLs = [...new Set(daten.lieferscheine.map((l) => l.baustelleId).filter(Boolean))] as string[];

  return (
    <Seite titel="Lieferscheine">
      <div className="umschalter">
        {(['offen', 'geprueft', 'abgelegt', 'alle'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'an' : ''} onClick={() => setFilter(f)}>
            {f === 'alle' ? 'Alle' : LIEFERSCHEIN_STATUS[f].text}
          </button>
        ))}
      </div>
      <div className="knopfreihe">
        <select value={baustelle} onChange={(e) => setBaustelle(e.target.value)}>
          <option value="">Alle Baustellen</option>
          {baustellenMitLs.map((id) => (
            <option key={id} value={id}>
              {namen.baustelle(id)}
            </option>
          ))}
          <option value="ohne">Ohne Baustelle</option>
        </select>
        <button className="knopf" disabled={!liste.length || pdfLaeuft} onClick={pdf}>
          {pdfLaeuft ? 'PDF wird erstellt' : gewaehlt.size ? `${gewaehlt.size} als PDF` : 'Alle angezeigten als PDF'}
        </button>
      </div>

      {!liste.length && <Leer>Keine Lieferscheine in dieser Auswahl.</Leer>}
      {liste.map((l) => (
        <div key={l.id} className="karte lieferschein">
          <label className="haken">
            <input
              type="checkbox"
              checked={gewaehlt.has(l.id)}
              onChange={(e) => {
                const neu = new Set(gewaehlt);
                if (e.target.checked) neu.add(l.id);
                else neu.delete(l.id);
                setGewaehlt(neu);
              }}
            />
            auswählen
          </label>
          <div className="foto-raster">
            {l.seiten.map((p, i) => (
              <DateiBild key={p} pfad={p} alt={`Seite ${i + 1}`} klein />
            ))}
          </div>
          <div className="stapel">
            <select value={l.baustelleId ?? ''} onChange={(e) => void speichern('lieferscheine', { ...l, baustelleId: e.target.value || null })}>
              <option value="">Ohne Baustelle</option>
              {daten.baustellen.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input defaultValue={l.lieferant} placeholder="Lieferant" onBlur={(e) => e.target.value !== l.lieferant && void speichern('lieferscheine', { ...l, lieferant: e.target.value.trim() })} />
            <div className="leise-text">
              {namen.person(l.erfasstVon)}, {zeitpunkt(l.erfasstAm)}
            </div>
            <div className="knopfreihe">
              <Marke ton={LIEFERSCHEIN_STATUS[l.status].ton}>{LIEFERSCHEIN_STATUS[l.status].text}</Marke>
              {l.status !== 'geprueft' && (
                <button className="knopf klein" onClick={() => status(l, 'geprueft')}>
                  Geprüft
                </button>
              )}
              {l.status !== 'abgelegt' && (
                <button className="knopf klein" onClick={() => status(l, 'abgelegt')}>
                  Abgelegt
                </button>
              )}
              {l.status !== 'offen' && (
                <button className="knopf klein flach" onClick={() => status(l, 'offen')}>
                  Zurück auf Neu
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </Seite>
  );
}
