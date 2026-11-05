import { DateiBild, Leer, Marke, Seite } from '../komponenten/Bausteine';
import { useNamen, zeitpunkt } from '../lib/ansicht';
import { useDaten } from '../lib/daten';
import { datumKurz, plusTage, heuteIso } from '../lib/regeln';
import type { LieferscheinStatus, MeldungStatus } from '../lib/types';

export const MELDUNG_STATUS: Record<MeldungStatus, { text: string; ton: 'rot' | 'gelb' | 'gruen' }> = {
  offen: { text: 'Offen', ton: 'rot' },
  in_bearbeitung: { text: 'Wird erledigt', ton: 'gelb' },
  erledigt: { text: 'Erledigt', ton: 'gruen' }
};

export const LIEFERSCHEIN_STATUS: Record<LieferscheinStatus, { text: string; ton: 'rot' | 'gelb' | 'gruen' }> = {
  offen: { text: 'Neu', ton: 'rot' },
  geprueft: { text: 'Geprüft', ton: 'gelb' },
  abgelegt: { text: 'Abgelegt', ton: 'gruen' }
};

// Alles, was ich gemeldet habe, mit dem Stand der Bearbeitung. Ältere Erledigte nach 30 Tagen ausblenden.
export function MeineMeldungen() {
  const { daten, benutzer } = useDaten();
  const namen = useNamen();
  if (!benutzer) return null;
  const grenze = plusTage(heuteIso(), -30);

  type Eintrag = { id: string; zeit: string; titel: string; unter: string; marke: { text: string; ton: 'rot' | 'gelb' | 'gruen' | 'grau' }; bild: string | null };
  const eintraege: Eintrag[] = [
    ...daten.meldungen
      .filter((m) => m.melderId === benutzer.id && (m.status !== 'erledigt' || (m.erledigtAm ?? m.erstelltAm) >= grenze))
      .map((m) => ({
        id: m.id,
        zeit: m.erstelltAm,
        titel: m.art === 'material' ? `Material: ${m.material}` : `Maschine: ${namen.maschine(m.maschineId) || 'nicht in der Liste'}${m.arbeitSteht ? ', Arbeit steht' : ''}`,
        unter: [namen.baustelle(m.baustelleId), m.menge, m.benoetigtBis && `bis ${datumKurz(m.benoetigtBis)}`, m.beschreibung].filter(Boolean).join(' · '),
        marke: MELDUNG_STATUS[m.status],
        bild: m.fotoPfad
      })),
    ...daten.lieferscheine
      .filter((l) => l.erfasstVon === benutzer.id && l.erfasstAm >= grenze)
      .map((l) => ({
        id: l.id,
        zeit: l.erfasstAm,
        titel: `Lieferschein${l.lieferant ? ` ${l.lieferant}` : ''}`,
        unter: `${namen.baustelle(l.baustelleId)} · ${l.seiten.length} ${l.seiten.length === 1 ? 'Seite' : 'Seiten'}`,
        marke: LIEFERSCHEIN_STATUS[l.status],
        bild: l.seiten[0] ?? null
      })),
    ...daten.krankmeldungen
      .filter((k) => k.personId === benutzer.id && k.gemeldetAm >= grenze)
      .map((k) => ({
        id: k.id,
        zeit: k.gemeldetAm,
        titel: 'Krankmeldung',
        unter: `ab ${datumKurz(k.ab)}${k.bisVoraussichtlich ? `, voraussichtlich bis ${datumKurz(k.bisVoraussichtlich)}` : ''}`,
        marke: { text: 'Gemeldet', ton: 'grau' as const },
        bild: null
      }))
  ].sort((a, b) => b.zeit.localeCompare(a.zeit));

  return (
    <Seite titel="Meine Meldungen">
      {!eintraege.length && <Leer>Du hast in den letzten 30 Tagen nichts gemeldet.</Leer>}
      {eintraege.map((e) => (
        <div key={e.id} className="zeile">
          {e.bild && <DateiBild pfad={e.bild} alt="" klein />}
          <div className="wachsen">
            <strong>{e.titel}</strong>
            <div className="leise-text">{e.unter}</div>
            <div className="leise-text">{zeitpunkt(e.zeit)}</div>
          </div>
          <Marke ton={e.marke.ton}>{e.marke.text}</Marke>
        </div>
      ))}
    </Seite>
  );
}
