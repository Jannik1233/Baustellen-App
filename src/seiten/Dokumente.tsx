import { useState } from 'react';
import { Leer, Marke, Seite } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { Symbol } from '../komponenten/Symbol';
import { useNamen } from '../lib/ansicht';
import { dateiUrl, useDaten, useSichtbareBaustellen } from '../lib/daten';
import type { Dokument, DokumentKategorie } from '../lib/types';

export const KATEGORIE_TEXT: Record<DokumentKategorie, string> = {
  plan: 'Plan oder Zeichnung',
  lv: 'Leistungsverzeichnis',
  farbkarte: 'Farbkarte',
  sicherheitsdatenblatt: 'Sicherheitsdatenblatt',
  betriebsanweisung: 'Betriebsanweisung',
  unterweisung: 'Unterweisung',
  sonstiges: 'Sonstiges'
};

export function DokumentZeile({ dokument, aktion }: { dokument: Dokument; aktion?: React.ReactNode }) {
  const zeigen = useHinweis();
  const [laedt, setLaedt] = useState(false);
  async function oeffnen() {
    // Fenster sofort öffnen, sonst blockiert das iPhone es als Pop-up
    const fenster = window.open('', '_blank');
    setLaedt(true);
    try {
      const url = await dateiUrl(dokument.pfad);
      if (fenster) fenster.location.href = url;
      else window.location.href = url;
    } catch {
      fenster?.close();
      zeigen('Das Dokument konnte nicht geladen werden. Ohne Netz gibt es nur Dokumente, die das Büro für unterwegs freigegeben hat.', { fehler: true });
    } finally {
      setLaedt(false);
    }
  }
  return (
    <div className="zeile">
      <button className="zeile-knopf wachsen" onClick={oeffnen}>
        <Symbol name="dokument" />
        <span>
          <strong>{dokument.titel}</strong>
          <span className="leise-text">
            {KATEGORIE_TEXT[dokument.kategorie]}
            {laedt ? ', wird geladen' : ''}
          </span>
        </span>
      </button>
      {dokument.offline && <Marke ton="blau">offline</Marke>}
      {aktion}
    </div>
  );
}

export function Dokumente() {
  const { daten } = useDaten();
  const sichtbar = useSichtbareBaustellen();
  const namen = useNamen();
  const ids = new Set(sichtbar.map((b) => b.id));
  const allgemein = daten.dokumente.filter((d) => !d.baustelleId).sort((a, b) => a.titel.localeCompare(b.titel));
  const jeBaustelle = new Map<string, Dokument[]>();
  for (const d of daten.dokumente) if (d.baustelleId && ids.has(d.baustelleId)) jeBaustelle.set(d.baustelleId, [...(jeBaustelle.get(d.baustelleId) ?? []), d]);

  return (
    <Seite titel="Dokumente" zurueck="/mehr">
      <h2>Allgemein</h2>
      {!allgemein.length && <Leer>Keine allgemeinen Dokumente.</Leer>}
      {allgemein.map((d) => (
        <DokumentZeile key={d.id} dokument={d} />
      ))}
      {[...jeBaustelle.entries()].map(([id, liste]) => (
        <section key={id}>
          <h2>{namen.baustelle(id)}</h2>
          {liste.map((d) => (
            <DokumentZeile key={d.id} dokument={d} />
          ))}
        </section>
      ))}
    </Seite>
  );
}
