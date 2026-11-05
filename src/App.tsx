import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { istAdmin, istBuero, offlineVorhalten, useDaten } from './lib/daten';
import { useOffeneBestaetigung } from './lib/ansicht';
import { Symbol, type SymbolName } from './komponenten/Symbol';
import { Anmelden } from './seiten/Anmelden';
import { Heute } from './seiten/Heute';
import { Woche } from './seiten/Woche';
import { BaustellenBlatt } from './seiten/BaustellenBlatt';
import { LieferscheinMelden, MaschineMelden, MaterialMelden, KrankMelden } from './seiten/Melden';
import { MeineMeldungen } from './seiten/MeineMeldungen';
import { Urlaub } from './seiten/Urlaub';
import { Dokumente } from './seiten/Dokumente';
import { Maschinen } from './seiten/Maschinen';
import { Mehr } from './seiten/Mehr';
import { MeineStunden } from './seiten/MeineStunden';
import { Eingang } from './seiten/buero/Eingang';
import { Wochenplan } from './seiten/buero/Wochenplan';
import { Baustellen, BaustelleBearbeiten } from './seiten/buero/Baustellen';
import { WinworkerImport } from './seiten/buero/WinworkerImport';
import { Lieferscheine } from './seiten/buero/Lieferscheine';
import { Meldungen } from './seiten/buero/Meldungen';
import { Abwesenheiten } from './seiten/buero/Abwesenheiten';
import { MaschinenVerwalten } from './seiten/buero/MaschinenVerwalten';
import { DokumenteVerwalten } from './seiten/buero/DokumenteVerwalten';
import { Personen } from './seiten/buero/Personen';
import { Einstellungen } from './seiten/buero/Einstellungen';
import { Stunden } from './seiten/buero/Stunden';

interface Ziel {
  zu: string;
  text: string;
  symbol: SymbolName;
  punkt?: boolean;
}

export function App() {
  const { benutzer, laedt, quelle, online, wartend, abgelehnt, daten, stand } = useDaten();
  const offeneBestaetigung = useOffeneBestaetigung();

  // Nach jedem Laden die Dokumente, die das Büro für unterwegs markiert hat, aufs Gerät holen
  useEffect(() => {
    if (stand) void offlineVorhalten(daten.dokumente.filter((d) => d.offline).map((d) => d.pfad));
  }, [stand, daten.dokumente]);

  if (laedt && !benutzer) return <div className="start-laedt">Frohes Schaffen wird geladen</div>;
  if (!benutzer) return <Anmelden />;

  const buero = istBuero(benutzer);
  const admin = istAdmin(benutzer);

  // Unten auf dem Handy höchstens fünf Ziele, am PC alles in der Seitenleiste
  const handy: Ziel[] = buero
    ? [
        { zu: '/buero', text: 'Eingang', symbol: 'eingang' },
        { zu: '/buero/plan', text: 'Plan', symbol: 'woche' },
        { zu: '/', text: 'Heute', symbol: 'heute' },
        { zu: '/buero/lieferscheine', text: 'Lieferscheine', symbol: 'lieferschein' },
        { zu: '/mehr', text: 'Mehr', symbol: 'mehr' }
      ]
    : [
        { zu: '/', text: 'Heute', symbol: 'heute' },
        { zu: '/woche', text: 'Woche', symbol: 'woche', punkt: Boolean(offeneBestaetigung) },
        { zu: '/meine-meldungen', text: 'Meldungen', symbol: 'liste' },
        { zu: '/mehr', text: 'Mehr', symbol: 'mehr' }
      ];

  const seitenleiste: { gruppe: string; ziele: Ziel[] }[] = [
    {
      gruppe: 'Für mich',
      ziele: [
        { zu: '/', text: 'Heute', symbol: 'heute' },
        { zu: '/woche', text: 'Meine Woche', symbol: 'woche', punkt: Boolean(offeneBestaetigung) },
        { zu: '/stunden', text: 'Meine Stunden', symbol: 'uhr' },
        { zu: '/urlaub', text: 'Urlaub', symbol: 'urlaub' },
        { zu: '/dokumente', text: 'Dokumente', symbol: 'dokument' },
        { zu: '/maschinen', text: 'Maschinen', symbol: 'maschine' }
      ]
    },
    ...(buero
      ? [
          {
            gruppe: 'Büro',
            ziele: [
              { zu: '/buero', text: 'Eingang', symbol: 'eingang' },
              { zu: '/buero/plan', text: 'Wochenplan', symbol: 'woche' },
              { zu: '/buero/stunden', text: 'Stunden', symbol: 'uhr' },
              { zu: '/buero/baustellen', text: 'Baustellen', symbol: 'baustelle' },
              { zu: '/buero/lieferscheine', text: 'Lieferscheine', symbol: 'lieferschein' },
              { zu: '/buero/meldungen', text: 'Meldungen', symbol: 'warnung' },
              { zu: '/buero/abwesenheiten', text: 'Urlaub und Abwesenheit', symbol: 'urlaub' },
              { zu: '/buero/maschinen', text: 'Maschinen verwalten', symbol: 'maschine' },
              { zu: '/buero/dokumente', text: 'Dokumente verwalten', symbol: 'dokument' },
              ...(admin
                ? [
                    { zu: '/buero/personen', text: 'Personen', symbol: 'person' },
                    { zu: '/buero/einstellungen', text: 'Einstellungen', symbol: 'einstellungen' }
                  ]
                : [])
            ] as Ziel[]
          }
        ]
      : []),
    { gruppe: '', ziele: [{ zu: '/mehr', text: 'Mehr', symbol: 'mehr' }] }
  ];

  return (
    <div className="rahmen">
      <aside className="seitenleiste">
        <div className="marke-kopf">
          <img src="/logo.png" alt="Maler GmbH Frohes Schaffen" />
          <span>Angemeldet: {benutzer.name}</span>
        </div>
        {seitenleiste.map((g) => (
          <nav key={g.gruppe || 'rest'}>
            {g.gruppe && <div className="nav-gruppe">{g.gruppe}</div>}
            {g.ziele.map((z) => (
              <NavLink key={z.zu} to={z.zu} end className="nav-ziel">
                <Symbol name={z.symbol} />
                {z.text}
                {z.punkt && <i className="punkt" aria-label="offen" />}
              </NavLink>
            ))}
          </nav>
        ))}
      </aside>

      <main className="inhalt">
        {quelle.modus === 'demo' && <div className="band demo">Testbetrieb: Daten liegen nur in diesem Browser</div>}
        {!online && <div className="band offline">Kein Netz. Alles wird gespeichert und später gesendet{wartend ? ` (${wartend} wartend)` : ''}.</div>}
        {abgelehnt.length > 0 && (
          <NavLink to="/mehr" className="band fehler">
            {abgelehnt.length === 1 ? 'Eine Änderung wurde' : `${abgelehnt.length} Änderungen wurden`} vom Server abgelehnt. Bitte unter Mehr ansehen.
          </NavLink>
        )}
        <Routes>
          <Route path="/" element={<Heute />} />
          <Route path="/woche" element={<Woche />} />
          <Route path="/baustelle/:id" element={<BaustellenBlatt />} />
          <Route path="/melden/lieferschein" element={<LieferscheinMelden />} />
          <Route path="/melden/material" element={<MaterialMelden />} />
          <Route path="/melden/maschine" element={<MaschineMelden />} />
          <Route path="/melden/krank" element={<KrankMelden />} />
          <Route path="/meine-meldungen" element={<MeineMeldungen />} />
          <Route path="/urlaub" element={<Urlaub />} />
          <Route path="/dokumente" element={<Dokumente />} />
          <Route path="/maschinen" element={<Maschinen />} />
          <Route path="/stunden" element={<MeineStunden />} />
          <Route path="/mehr" element={<Mehr />} />
          {buero && (
            <>
              <Route path="/buero" element={<Eingang />} />
              <Route path="/buero/plan" element={<Wochenplan />} />
              <Route path="/buero/stunden" element={<Stunden />} />
              <Route path="/buero/baustellen" element={<Baustellen />} />
              <Route path="/buero/baustellen/:id" element={<BaustelleBearbeiten />} />
              <Route path="/buero/import" element={<WinworkerImport />} />
              <Route path="/buero/lieferscheine" element={<Lieferscheine />} />
              <Route path="/buero/meldungen" element={<Meldungen />} />
              <Route path="/buero/abwesenheiten" element={<Abwesenheiten />} />
              <Route path="/buero/maschinen" element={<MaschinenVerwalten />} />
              <Route path="/buero/dokumente" element={<DokumenteVerwalten />} />
              {admin && <Route path="/buero/personen" element={<Personen />} />}
              {admin && <Route path="/buero/einstellungen" element={<Einstellungen />} />}
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="leiste-unten">
        {handy.map((z) => (
          <NavLink key={z.zu} to={z.zu} end className="leiste-ziel">
            <Symbol name={z.symbol} groesse={24} />
            {z.text}
            {z.punkt && <i className="punkt" aria-label="offen" />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
