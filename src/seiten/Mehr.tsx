import { useEffect, useState } from 'react';
import { Kachel, Seite } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { zeitpunkt } from '../lib/ansicht';
import { istAdmin, istBuero, useDaten } from '../lib/daten';
import { demoZuruecksetzen } from '../lib/demoQuelle';
import { istIphone, pushEinschalten, pushZustand, type PushZustand } from '../lib/push';

const ART_TEXT: Record<string, string> = {
  meldungen: 'Meldung',
  lieferscheine: 'Lieferschein',
  abwesenheiten: 'Urlaub oder Abwesenheit',
  krankmeldungen: 'Krankmeldung',
  bestaetigungen: 'Plan gelesen',
  fotos: 'Foto'
};

function Benachrichtigungen() {
  const { quelle, benutzer, einstellungen } = useDaten();
  const zeigen = useHinweis();
  const [zustand, setZustand] = useState<PushZustand | null>(null);
  useEffect(() => {
    void pushZustand().then(setZustand);
  }, []);

  if (!zustand) return null;
  return (
    <div className="karte stapel">
      <h2>Benachrichtigungen</h2>
      {zustand === 'an' && <p>Sind eingeschaltet. Sie kommen nur Montag bis Freitag zwischen {einstellungen.pushVon} und {einstellungen.pushBis} Uhr.</p>}
      {zustand === 'aus' && (
        <>
          <p>Damit du Planänderungen sofort erfährst. Nur Montag bis Freitag, nie abends oder am Wochenende.</p>
          <button
            className="knopf haupt gross"
            onClick={async () => {
              const f = await pushEinschalten(quelle, benutzer!.id);
              if (f) zeigen(f, { fehler: true });
              else zeigen('Benachrichtigungen sind eingeschaltet.');
              setZustand(await pushZustand());
            }}
          >
            Einschalten
          </button>
        </>
      )}
      {zustand === 'startbildschirm-noetig' && (
        <p>
          Auf dem iPhone gehen Benachrichtigungen nur, wenn die App auf dem Startbildschirm liegt: in Safari unten auf Teilen tippen, dann „Zum Home-Bildschirm“. Danach die App von dort öffnen und hier
          einschalten.
        </p>
      )}
      {zustand === 'abgelehnt' && (
        <p>
          Benachrichtigungen sind für diese App gesperrt. {istIphone() ? 'In den iPhone-Einstellungen unter Mitteilungen' : 'In den Einstellungen des Handys unter Apps oder Benachrichtigungen'} lässt
          sich das wieder erlauben.
        </p>
      )}
      {zustand === 'nicht-moeglich' && <p>Dieser Browser kann keine Benachrichtigungen anzeigen. Bitte Chrome (Android) oder Safari (iPhone) verwenden.</p>}
    </div>
  );
}

export function Mehr() {
  const { benutzer, quelle, stand, wartend, abgelehnt, abgelehnteVerwerfen, neuLaden, abmelden } = useDaten();
  const zeigen = useHinweis();
  if (!benutzer) return null;
  const buero = istBuero(benutzer);

  return (
    <Seite titel="Mehr">
      <div className="kacheln">
        <Kachel zu="/woche" titel="Meine Woche" symbol="woche" />
        <Kachel zu="/stunden" titel="Meine Stunden" symbol="uhr" />
        <Kachel zu="/urlaub" titel="Urlaub" symbol="urlaub" />
        <Kachel zu="/meine-meldungen" titel="Meine Meldungen" symbol="liste" />
        <Kachel zu="/dokumente" titel="Dokumente" symbol="dokument" />
        <Kachel zu="/maschinen" titel="Maschinen" symbol="maschine" />
      </div>

      {buero && (
        <>
          <h2>Büro</h2>
          <div className="kacheln">
            <Kachel zu="/buero/stunden" titel="Stunden" symbol="uhr" />
            <Kachel zu="/buero/baustellen" titel="Baustellen" symbol="baustelle" />
            <Kachel zu="/buero/meldungen" titel="Meldungen" symbol="warnung" />
            <Kachel zu="/buero/abwesenheiten" titel="Urlaub und Abwesenheit" symbol="urlaub" />
            <Kachel zu="/buero/maschinen" titel="Maschinen verwalten" symbol="maschine" />
            <Kachel zu="/buero/dokumente" titel="Dokumente verwalten" symbol="dokument" />
            {istAdmin(benutzer) && <Kachel zu="/buero/personen" titel="Personen" symbol="person" />}
            {istAdmin(benutzer) && <Kachel zu="/buero/einstellungen" titel="Einstellungen" symbol="einstellungen" />}
          </div>
        </>
      )}

      <Benachrichtigungen />

      <div className="karte stapel">
        <h2>Verbindung</h2>
        <p>
          {stand ? `Zuletzt aktualisiert ${zeitpunkt(stand)}.` : 'Noch nicht aktualisiert.'} {wartend ? `${wartend} Änderungen warten auf Netz.` : 'Alles ist gesendet.'}
        </p>
        <button className="knopf" onClick={() => void neuLaden()}>
          Jetzt aktualisieren
        </button>
        {abgelehnt.length > 0 && (
          <>
            <p className="fehlertext">Diese Änderungen hat der Server nicht angenommen, meistens wegen fehlender Rechte:</p>
            <ul>
              {abgelehnt.map((f, i) => (
                <li key={i}>
                  {f.vorgang.art === 'datei' ? 'Datei' : ART_TEXT[f.vorgang.tabelle] ?? f.vorgang.tabelle}: {f.meldung}
                </li>
              ))}
            </ul>
            <button className="knopf" onClick={() => void abgelehnteVerwerfen()}>
              Liste leeren
            </button>
          </>
        )}
      </div>

      <div className="karte stapel">
        <h2>{benutzer.name}</h2>
        <a className="knopf" href="/datenschutz.html" target="_blank" rel="noreferrer">
          Datenschutzinformation
        </a>
        {quelle.modus === 'demo' && (
          <button
            className="knopf"
            onClick={async () => {
              demoZuruecksetzen();
              await abmelden();
              zeigen('Alle Daten wurden auf den Anfang zurückgesetzt.');
            }}
          >
            Alles auf Anfang setzen
          </button>
        )}
        <button className="knopf" onClick={() => void abmelden()}>
          {quelle.modus === 'demo' ? 'Person wechseln' : 'Abmelden'}
        </button>
      </div>
    </Seite>
  );
}
