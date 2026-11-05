import { Link } from 'react-router-dom';
import { Leer, Marke, Seite } from '../../komponenten/Bausteine';
import { useNamen, zeitpunkt } from '../../lib/ansicht';
import { useDaten } from '../../lib/daten';
import { datumKurz, heuteIso, montagDerWoche, naechstePruefung, plusTage, pruefStatus } from '../../lib/regeln';

// Alles, was das Büro heute angehen muss, auf einer Seite
export function Eingang() {
  const { daten } = useDaten();
  const namen = useNamen();
  const heute = heuteIso();

  const meldungen = daten.meldungen.filter((m) => m.status !== 'erledigt').sort((a, b) => Number(b.arbeitSteht) - Number(a.arbeitSteht) || a.erstelltAm.localeCompare(b.erstelltAm));
  const lieferscheine = daten.lieferscheine.filter((l) => l.status === 'offen');
  const antraege = daten.abwesenheiten.filter((a) => a.status === 'beantragt');
  const neueKrank = daten.krankmeldungen.filter((k) => k.gemeldetAm >= plusTage(heute, -1) || (k.bisVoraussichtlich ?? k.ab) >= heute);

  // Wer hat den aktuellen Plan noch nicht gelesen
  const ab = montagDerWoche(heute);
  const fassungen = new Map(daten.planfassungen.map((f) => [f.id, f]));
  const ungelesen = daten.bestaetigungen.filter((b) => !b.bestaetigtAm && (fassungen.get(b.planfassungId)?.woche ?? '') >= ab);
  const ungelesenNachPerson = [...new Set(ungelesen.map((b) => b.personId))];

  const pruefungen = daten.pruefungen.filter((p) => ['ueberfaellig', 'bald'].includes(pruefStatus(p, heute)));

  return (
    <Seite titel="Eingang">
      <section>
        <h2>
          Meldungen <Link to="/buero/meldungen">alle</Link>
        </h2>
        {!meldungen.length && <Leer>Keine offenen Meldungen.</Leer>}
        {meldungen.slice(0, 8).map((m) => (
          <Link key={m.id} to="/buero/meldungen" className="zeile">
            <div className="wachsen">
              <strong>{m.art === 'material' ? `Material: ${m.material}` : `Maschine: ${namen.maschine(m.maschineId) || m.beschreibung || 'nicht in der Liste'}`}</strong>
              <div className="leise-text">
                {namen.person(m.melderId)} · {namen.baustelle(m.baustelleId)} · {zeitpunkt(m.erstelltAm)}
              </div>
            </div>
            {m.arbeitSteht && <Marke ton="rot">Arbeit steht</Marke>}
            {m.benoetigtBis && <Marke ton={m.benoetigtBis <= heute ? 'rot' : 'gelb'}>bis {datumKurz(m.benoetigtBis)}</Marke>}
            {m.status === 'in_bearbeitung' && <Marke ton="gelb">wird erledigt</Marke>}
          </Link>
        ))}
      </section>

      <section>
        <h2>
          Neue Lieferscheine <Link to="/buero/lieferscheine">alle</Link>
        </h2>
        {!lieferscheine.length ? <Leer>Keine neuen Lieferscheine.</Leer> : <Link to="/buero/lieferscheine" className="zeile">{lieferscheine.length} zu prüfen</Link>}
      </section>

      {neueKrank.length > 0 && (
        <section>
          <h2>Krank gemeldet</h2>
          {neueKrank.map((k) => (
            <div key={k.id} className="zeile">
              <strong className="wachsen">{namen.person(k.personId)}</strong>
              <span className="leise-text">
                ab {datumKurz(k.ab)}
                {k.bisVoraussichtlich ? ` bis ${datumKurz(k.bisVoraussichtlich)}` : ', Dauer offen'}
              </span>
            </div>
          ))}
          <Link to="/buero/plan" className="leise-text">
            Plan anpassen
          </Link>
        </section>
      )}

      {antraege.length > 0 && (
        <section>
          <h2>Urlaubsanträge</h2>
          {antraege.map((a) => (
            <Link key={a.id} to="/buero/abwesenheiten" className="zeile">
              <strong className="wachsen">{namen.person(a.personId)}</strong>
              <span>
                {datumKurz(a.von)} bis {datumKurz(a.bis)}
              </span>
            </Link>
          ))}
        </section>
      )}

      {ungelesenNachPerson.length > 0 && (
        <section>
          <h2>Plan noch nicht gelesen</h2>
          <Link to="/buero/plan" className="zeile">
            {ungelesenNachPerson.map((id) => namen.person(id)).join(', ')}
          </Link>
        </section>
      )}

      {pruefungen.length > 0 && (
        <section>
          <h2>Prüftermine</h2>
          {pruefungen.map((p) => (
            <Link key={p.id} to="/buero/maschinen" className="zeile">
              <strong className="wachsen">
                {namen.maschine(p.maschineId)}, {p.art}
              </strong>
              <Marke ton={pruefStatus(p, heute) === 'ueberfaellig' ? 'rot' : 'gelb'}>{datumKurz(naechstePruefung(p))}</Marke>
            </Link>
          ))}
        </section>
      )}
    </Seite>
  );
}
