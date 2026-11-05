import { Link } from 'react-router-dom';
import { EinsatzKarte } from '../komponenten/EinsatzKarte';
import { StundenKarte } from '../komponenten/StundenKarte';
import { Kachel } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { einsaetzeAm, useBestaetigen, useOffeneBestaetigung } from '../lib/ansicht';
import { istBuero, useDaten } from '../lib/daten';
import { ABWESENHEIT_TEXT, abwesenheitAm, datumKurz, datumLang, feiertag, heuteIso, plusTage, wochentag } from '../lib/regeln';
import { sollEintragen, stundenAm } from '../lib/stunden';

function gruss(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  return 'Guten Abend';
}

export function Heute() {
  const { daten, benutzer } = useDaten();
  const offen = useOffeneBestaetigung();
  const bestaetigen = useBestaetigen();
  const zeigen = useHinweis();
  if (!benutzer) return null;

  const heute = heuteIso();
  const heutige = einsaetzeAm(daten.einsaetze, benutzer.id, heute);
  const abwesend = abwesenheitAm(benutzer.id, heute, daten.abwesenheiten);
  const ft = feiertag(heute);

  // Stundenzettel: heute, und der letzte Arbeitstag davor, falls dort noch nichts eingetragen ist
  const stundenHeute = sollEintragen(benutzer, heute, daten.einsaetze, daten.abwesenheiten) || stundenAm(daten.stunden, benutzer.id, heute).length > 0;
  const nachtragen = [1, 2, 3, 4, 5, 6, 7]
    .map((n) => plusTage(heute, -n))
    .find((d) => sollEintragen(benutzer, d, daten.einsaetze, daten.abwesenheiten));
  const nachtragenOffen = nachtragen && !stundenAm(daten.stunden, benutzer.id, nachtragen).length ? nachtragen : null;

  // Wenn heute nichts ansteht: der nächste Einsatz in den kommenden 14 Tagen
  const naechster = heutige.length
    ? null
    : daten.einsaetze
        .filter((e) => e.personId === benutzer.id && e.datum > heute)
        .sort((a, b) => a.datum.localeCompare(b.datum) || a.beginn.localeCompare(b.beginn))[0] ?? null;

  return (
    <div className="seite">
      <img className="logo-kopf" src="/logo.png" alt="Maler GmbH Frohes Schaffen" />
      <header className="seiten-kopf gross">
        <div>
          <h1>
            {gruss()}, {benutzer.name.split(' ')[0]}
          </h1>
          <p className="unterzeile">{datumLang(heute)}</p>
        </div>
      </header>

      {offen && (
        <div className="karte hervor">
          <strong>Der Plan für KW {offen.kw} wurde geändert.</strong>
          {offen.fassung.hinweis && <p>{offen.fassung.hinweis}</p>}
          <div className="knopfreihe">
            <Link className="knopf" to="/woche">
              Ansehen
            </Link>
            <button
              className="knopf haupt"
              onClick={async () => {
                await bestaetigen(offen.fassung.woche);
                zeigen('Danke, als gelesen gemeldet.');
              }}
            >
              Gelesen
            </button>
          </div>
        </div>
      )}

      <section>
        <h2>Heute</h2>
        {heutige.map((e) => (
          <EinsatzKarte key={e.id} einsatz={e} />
        ))}
        {!heutige.length && (
          <div className="karte leise">
            {abwesend ? `Heute eingetragen: ${ABWESENHEIT_TEXT[abwesend.art]}.` : ft ? `Heute ist Feiertag (${ft}).` : 'Heute bist du nicht eingeplant.'}
            {naechster && (
              <p>
                Nächster Einsatz: {wochentag(naechster.datum)}, {datumKurz(naechster.datum)}.
              </p>
            )}
            {!naechster && !istBuero(benutzer) && <p>Für die nächsten Tage ist noch nichts geplant.</p>}
          </div>
        )}
      </section>

      {(stundenHeute || nachtragenOffen) && (
        <section>
          <h2>Stunden</h2>
          {nachtragenOffen && <StundenKarte datum={nachtragenOffen} titel={`Noch offen: ${wochentag(nachtragenOffen)}, ${datumKurz(nachtragenOffen)}`} />}
          {stundenHeute && <StundenKarte datum={heute} titel="Heute" />}
          <Link to="/stunden" className="leise-text">
            Alle meine Stunden
          </Link>
        </section>
      )}

      <section>
        <h2>Melden</h2>
        <div className="kacheln">
          <Kachel zu="/melden/lieferschein" titel="Lieferschein" unter="fotografieren" symbol="lieferschein" ton="blau" />
          <Kachel zu="/melden/material" titel="Material" unter="fehlt oder wird knapp" symbol="material" ton="gelb" />
          <Kachel zu="/melden/maschine" titel="Maschine" unter="kaputt oder fehlt" symbol="maschine" ton="rot" />
          <Kachel zu="/melden/krank" titel="Krank" unter="heute nicht da" symbol="krank" />
        </div>
      </section>
    </div>
  );
}
