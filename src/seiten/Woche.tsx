import { useState } from 'react';
import { EinsatzKarte } from '../komponenten/EinsatzKarte';
import { Seite } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { einsaetzeAm, offeneBestaetigungen, useBestaetigen } from '../lib/ansicht';
import { useDaten } from '../lib/daten';
import { ABWESENHEIT_TEXT, abwesenheitAm, datumKurz, feiertag, heuteIso, kalenderwoche, montagDerWoche, plusTage, tageDerWoche, wochentag } from '../lib/regeln';

export function Woche() {
  const { daten, benutzer } = useDaten();
  const bestaetigen = useBestaetigen();
  const zeigen = useHinweis();
  const diese = montagDerWoche(heuteIso());
  const [montag, setMontag] = useState(diese);
  if (!benutzer) return null;

  const offen = offeneBestaetigungen(daten, benutzer.id).find((o) => o.fassung.woche === montag);
  const heute = heuteIso();

  return (
    <Seite titel="Meine Woche">
      <div className="umschalter">
        <button className={montag === diese ? 'an' : ''} onClick={() => setMontag(diese)}>
          Diese Woche
        </button>
        <button className={montag !== diese ? 'an' : ''} onClick={() => setMontag(plusTage(diese, 7))}>
          Nächste Woche
        </button>
      </div>
      <p className="unterzeile">
        KW {kalenderwoche(montag)}, {datumKurz(montag)} bis {datumKurz(plusTage(montag, 4))}
      </p>

      {offen && (
        <div className="karte hervor">
          <strong>Dieser Plan wurde geändert.</strong>
          {offen.fassung.hinweis && <p>{offen.fassung.hinweis}</p>}
          <button
            className="knopf haupt gross"
            onClick={async () => {
              await bestaetigen(montag);
              zeigen('Danke, als gelesen gemeldet.');
            }}
          >
            Gelesen
          </button>
        </div>
      )}

      {tageDerWoche(montag, 5).map((tag) => {
        const eigene = einsaetzeAm(daten.einsaetze, benutzer.id, tag);
        const abw = abwesenheitAm(benutzer.id, tag, daten.abwesenheiten);
        const ft = feiertag(tag);
        return (
          <section key={tag} className={`tag ${tag === heute ? 'heute' : ''} ${tag < heute ? 'vorbei' : ''}`}>
            <h3>
              {wochentag(tag)} <span>{datumKurz(tag)}</span>
            </h3>
            {eigene.map((e) => (
              <EinsatzKarte key={e.id} einsatz={e} kompakt />
            ))}
            {!eigene.length && <div className="karte leise">{abw ? ABWESENHEIT_TEXT[abw.art] : ft ? `Feiertag: ${ft}` : 'Nicht eingeplant'}</div>}
          </section>
        );
      })}
    </Seite>
  );
}
