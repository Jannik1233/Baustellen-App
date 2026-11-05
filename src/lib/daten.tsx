import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { neueId, istNetzfehler, type Datenquelle } from './datenquelle';
import { demoQuelle } from './demoQuelle';
import { dateiSchluessel, einreihen, fehlschlaege, fehlschlaegeLeeren, senden, wartende, zurueckholen, type Fehlschlag } from './postausgang';
import { heuteIso, sichtbareBaustellenIds, type PlanAenderung } from './regeln';
import { entfernen, lesen, schluesselMit, schreiben } from './speicher';
import { supabaseKonfiguriert, supabaseQuelle } from './supabaseQuelle';
import {
  leererBestand, STANDARD_EINSTELLUNGEN, TABELLEN, type Bestand, type Einstellungen, type Person, type Planfassung, type Tabellen, type TabellenName
} from './types';

export const quelle: Datenquelle = supabaseKonfiguriert() ? supabaseQuelle : demoQuelle;

const CACHE = (personId: string) => `bestand:${personId}`;
// So lange kann eine Meldung zurückgenommen werden, bevor sie verschickt wird
export const VERZOEGERUNG_MS = 5000;

export interface SpeicherOptionen {
  verzoegert?: boolean; // erst nach VERZOEGERUNG_MS senden, damit "Rückgängig" möglich ist
}
const LETZTER_BENUTZER = 'letzter-benutzer';

interface Kontext {
  quelle: Datenquelle;
  benutzer: Person | null;
  laedt: boolean;
  fehler: string | null;
  daten: Bestand;
  einstellungen: Einstellungen;
  online: boolean; // letzte Verbindung zum Server hat geklappt
  wartend: number; // Vorgänge im Postausgang
  abgelehnt: Fehlschlag[];
  stand: string | null; // Zeitpunkt der letzten erfolgreichen Aktualisierung
  neuLaden: () => Promise<void>;
  // Liefert die Nummer im Postausgang, mit der sich der Vorgang zurücknehmen lässt
  speichern: <T extends TabellenName>(tabelle: T, zeile: Tabellen[T], optionen?: SpeicherOptionen) => Promise<number>;
  loeschen: (tabelle: TabellenName, id: string) => Promise<void>;
  dateiSpeichern: (pfad: string, datei: Blob, optionen?: SpeicherOptionen) => Promise<number>;
  // Nimmt noch nicht verschickte Vorgänge zurück und entfernt die Zeile wieder vom Gerät
  rueckgaengig: (nummern: number[], tabelle: TabellenName, id: string) => Promise<boolean>;
  planVeroeffentlichen: (montag: string, aenderung: PlanAenderung, hinweis: string) => Promise<Planfassung>;
  abgelehnteVerwerfen: () => Promise<void>;
  abmelden: () => Promise<void>;
}

const DatenKontext = createContext<Kontext | null>(null);

function zeileSetzen<T extends { id: string }>(liste: T[], zeile: T): T[] {
  const i = liste.findIndex((z) => z.id === zeile.id);
  return i >= 0 ? liste.map((z, j) => (j === i ? zeile : z)) : [...liste, zeile];
}

export function DatenProvider({ children }: { children: ReactNode }) {
  const [benutzer, setBenutzer] = useState<Person | null>(null);
  const [daten, setDaten] = useState<Bestand>(leererBestand);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [wartend, setWartend] = useState(0);
  const [abgelehnt, setAbgelehnt] = useState<Fehlschlag[]>([]);
  const [stand, setStand] = useState<string | null>(null);
  const benutzerRef = useRef<Person | null>(null);

  const postausgangPruefen = useCallback(async () => {
    setWartend((await wartende()).length);
    setAbgelehnt(await fehlschlaege());
  }, []);

  const nachschicken = useCallback(async () => {
    if (!benutzerRef.current) return;
    const r = await senden(quelle);
    if (r.gesendet > 0 || !r.netzfehler) setOnline(!r.netzfehler);
    await postausgangPruefen();
  }, [postausgangPruefen]);

  const neuLaden = useCallback(async () => {
    setFehler(null);
    try {
      // Zuerst den gespeicherten Stand zeigen, damit die App auch ohne Netz sofort etwas anzeigt
      const letzter = await lesen<Person>(LETZTER_BENUTZER);
      if (letzter && !benutzerRef.current) {
        const cache = await lesen<{ daten: Bestand; stand: string }>(CACHE(letzter.id));
        if (cache) {
          benutzerRef.current = letzter;
          setBenutzer(letzter);
          setDaten({ ...leererBestand(), ...cache.daten });
          setStand(cache.stand);
          setLaedt(false);
        }
      }
      const b = await quelle.aktuellerBenutzer();
      benutzerRef.current = b;
      setBenutzer(b);
      if (!b) {
        setLaedt(false);
        return;
      }
      await schreiben(LETZTER_BENUTZER, b);
      await nachschicken();
      const ergebnisse = await Promise.all(TABELLEN.map((t) => quelle.laden(t)));
      const neu = leererBestand() as Record<TabellenName, unknown[]>;
      TABELLEN.forEach((t, i) => (neu[t] = ergebnisse[i]));
      const jetzt = new Date().toISOString();
      setDaten(neu as Bestand);
      setStand(jetzt);
      setOnline(true);
      await schreiben(CACHE(b.id), { daten: neu, stand: jetzt });
    } catch (e) {
      if (istNetzfehler(e)) setOnline(false);
      else setFehler(e instanceof Error ? e.message : 'Unbekannter Fehler beim Laden.');
    } finally {
      setLaedt(false);
      await postausgangPruefen();
    }
  }, [nachschicken, postausgangPruefen]);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  // Nachschicken, sobald Netz da ist oder die App wieder in den Vordergrund kommt.
  // Auf dem iPhone geht das nicht im Hintergrund, deshalb zusätzlich beim Öffnen.
  useEffect(() => {
    const beiNetz = () => void neuLaden();
    const sichtbar = () => {
      if (document.visibilityState === 'visible') void neuLaden();
    };
    window.addEventListener('online', beiNetz);
    document.addEventListener('visibilitychange', sichtbar);
    const takt = window.setInterval(() => void nachschicken(), 60_000);
    return () => {
      window.removeEventListener('online', beiNetz);
      document.removeEventListener('visibilitychange', sichtbar);
      window.clearInterval(takt);
    };
  }, [neuLaden, nachschicken]);

  const cacheAktualisieren = useCallback((neu: Bestand) => {
    const b = benutzerRef.current;
    if (b) void schreiben(CACHE(b.id), { daten: neu, stand: new Date().toISOString() });
  }, []);

  // Die Datenbank leitet aus Krankmeldungen Abwesenheiten ab, die holen wir nach dem Senden ab
  const nachgeschickt = useCallback(
    async (tabelle: TabellenName) => {
      await nachschicken();
      if (tabelle !== 'krankmeldungen') return;
      try {
        const abw = await quelle.laden('abwesenheiten');
        setDaten((alt) => ({ ...alt, abwesenheiten: abw }));
      } catch {
        // ohne Netz später
      }
    },
    [nachschicken]
  );

  // Speichern geht immer sofort auf dem Gerät und wird dann über den Postausgang verschickt
  const speichern = useCallback(
    async <T extends TabellenName>(tabelle: T, zeile: Tabellen[T], optionen?: SpeicherOptionen) => {
      setDaten((alt) => {
        const neu = { ...alt, [tabelle]: zeileSetzen(alt[tabelle] as { id: string }[], zeile as { id: string }) } as Bestand;
        cacheAktualisieren(neu);
        return neu;
      });
      const ab = optionen?.verzoegert ? Date.now() + VERZOEGERUNG_MS : undefined;
      const nr = await einreihen({ art: 'speichern', tabelle, zeile: zeile as { id: string }, ab });
      if (ab) {
        await postausgangPruefen();
        window.setTimeout(() => void nachgeschickt(tabelle), VERZOEGERUNG_MS + 300);
      } else await nachgeschickt(tabelle);
      return nr;
    },
    [nachgeschickt, cacheAktualisieren, postausgangPruefen]
  );

  const rueckgaengig = useCallback(
    async (nummern: number[], tabelle: TabellenName, id: string) => {
      const ergebnisse = [];
      for (const nr of nummern) ergebnisse.push(await zurueckholen(nr));
      const ok = ergebnisse.every(Boolean);
      if (ok) {
        setDaten((alt) => {
          const neu = { ...alt, [tabelle]: (alt[tabelle] as { id: string }[]).filter((z) => z.id !== id) } as Bestand;
          cacheAktualisieren(neu);
          return neu;
        });
      }
      await postausgangPruefen();
      return ok;
    },
    [cacheAktualisieren, postausgangPruefen]
  );

  const loeschen = useCallback(
    async (tabelle: TabellenName, id: string) => {
      setDaten((alt) => {
        const neu = { ...alt, [tabelle]: (alt[tabelle] as { id: string }[]).filter((z) => z.id !== id) } as Bestand;
        cacheAktualisieren(neu);
        return neu;
      });
      await einreihen({ art: 'loeschen', tabelle, id });
      await nachschicken();
    },
    [nachschicken, cacheAktualisieren]
  );

  const dateiSpeichern = useCallback(
    async (pfad: string, datei: Blob, optionen?: SpeicherOptionen) => {
      const ab = optionen?.verzoegert ? Date.now() + VERZOEGERUNG_MS : undefined;
      const nr = await einreihen({ art: 'datei', pfad, ab }, datei);
      await postausgangPruefen();
      return nr;
    },
    [postausgangPruefen]
  );

  // Veröffentlichen braucht Netz, weil alle Beteiligten denselben Stand bekommen müssen
  const planVeroeffentlichen = useCallback(async (montag: string, aenderung: PlanAenderung, hinweis: string) => {
    const fassung = await quelle.planVeroeffentlichen(montag, aenderung, hinweis);
    const [einsaetze, planfassungen, bestaetigungen] = await Promise.all([
      quelle.laden('einsaetze'),
      quelle.laden('planfassungen'),
      quelle.laden('bestaetigungen')
    ]);
    setDaten((alt) => {
      const neu = { ...alt, einsaetze, planfassungen, bestaetigungen };
      cacheAktualisieren(neu);
      return neu;
    });
    return fassung;
  }, [cacheAktualisieren]);

  const abgelehnteVerwerfen = useCallback(async () => {
    await fehlschlaegeLeeren();
    await postausgangPruefen();
  }, [postausgangPruefen]);

  // Beim Abmelden alles vom Gerät entfernen, was nicht mehr gebraucht wird (zum Beispiel bei Handywechsel oder Ausscheiden).
  // Noch nicht gesendete Vorgänge bleiben, damit nichts verloren geht.
  const abmelden = useCallback(async () => {
    await quelle.abmelden();
    await schreiben(LETZTER_BENUTZER, null);
    const b = benutzerRef.current;
    if (b) await entfernen(CACHE(b.id));
    if (!(await wartende()).length) for (const k of await schluesselMit('datei:')) await entfernen(k);
    benutzerRef.current = null;
    setBenutzer(null);
    setDaten(leererBestand());
  }, []);

  const wert = useMemo<Kontext>(
    () => ({
      quelle,
      benutzer,
      laedt,
      fehler,
      daten,
      einstellungen: daten.einstellungen[0] ?? STANDARD_EINSTELLUNGEN,
      online,
      wartend,
      abgelehnt,
      stand,
      neuLaden,
      speichern,
      loeschen,
      dateiSpeichern,
      rueckgaengig,
      planVeroeffentlichen,
      abgelehnteVerwerfen,
      abmelden
    }),
    [benutzer, laedt, fehler, daten, online, wartend, abgelehnt, stand, neuLaden, speichern, loeschen, dateiSpeichern, rueckgaengig, planVeroeffentlichen, abgelehnteVerwerfen, abmelden]
  );

  return <DatenKontext.Provider value={wert}>{children}</DatenKontext.Provider>;
}

export function useDaten(): Kontext {
  const k = useContext(DatenKontext);
  if (!k) throw new Error('useDaten außerhalb von DatenProvider');
  return k;
}

export const istBuero = (b: Person | null) => b?.rolle === 'admin' || b?.rolle === 'buero';
export const istAdmin = (b: Person | null) => b?.rolle === 'admin';

// Was der angemeldete Benutzer sehen darf. Online setzt die Datenbank dieselben Regeln zusätzlich durch.
export function useSichtbareBaustellen() {
  const { daten, benutzer } = useDaten();
  return useMemo(() => {
    if (!benutzer || istBuero(benutzer)) return daten.baustellen;
    const ids = sichtbareBaustellenIds(benutzer.id, daten.einsaetze, heuteIso());
    return daten.baustellen.filter((b) => ids.has(b.id));
  }, [daten, benutzer]);
}

// Datei anzeigen: zuerst aus dem Gerätespeicher (auch ohne Netz), sonst vom Server laden und merken
const urlCache = new Map<string, string>();

export async function dateiBlob(pfad: string): Promise<Blob> {
  let blob = await lesen<Blob>(dateiSchluessel(pfad));
  if (!blob) {
    blob = await quelle.dateiLaden(pfad);
    await schreiben(dateiSchluessel(pfad), blob);
  }
  return blob;
}

export async function dateiUrl(pfad: string): Promise<string> {
  const vorhanden = urlCache.get(pfad);
  if (vorhanden) return vorhanden;
  const url = URL.createObjectURL(await dateiBlob(pfad));
  urlCache.set(pfad, url);
  return url;
}

export function useDateiUrl(pfad: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(pfad ? urlCache.get(pfad) ?? null : null);
  useEffect(() => {
    let aktiv = true;
    if (!pfad) return setUrl(null);
    dateiUrl(pfad)
      .then((u) => aktiv && setUrl(u))
      .catch(() => aktiv && setUrl(null));
    return () => {
      aktiv = false;
    };
  }, [pfad]);
  return url;
}

// Dokumente mit "offline" und Fotos der eigenen Baustellen im Hintergrund auf das Gerät holen
export async function offlineVorhalten(pfade: string[]): Promise<void> {
  for (const pfad of pfade) {
    try {
      if (!(await lesen<Blob>(dateiSchluessel(pfad)))) await schreiben(dateiSchluessel(pfad), await quelle.dateiLaden(pfad));
    } catch {
      return; // kein Netz: beim nächsten Mal
    }
  }
}

export { neueId };
