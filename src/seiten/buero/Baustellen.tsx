import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { JaNein, Leer, Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { istAdmin, neueId, useDaten } from '../../lib/daten';
import { adresse } from '../../lib/regeln';
import type { Baustelle, BaustellenStatus, KontaktRolle } from '../../lib/types';

const STATUS: Record<BaustellenStatus, { text: string; ton: 'blau' | 'gruen' | 'grau' }> = {
  geplant: { text: 'Geplant', ton: 'blau' },
  laeuft: { text: 'Läuft', ton: 'gruen' },
  abgeschlossen: { text: 'Abgeschlossen', ton: 'grau' }
};

export function Baustellen() {
  const { daten, benutzer } = useDaten();
  const [suche, setSuche] = useState('');
  const [alle, setAlle] = useState(false);
  const admin = istAdmin(benutzer);
  const s = suche.trim().toLowerCase();
  const liste = daten.baustellen
    .filter((b) => alle || b.status !== 'abgeschlossen')
    .filter((b) => !s || [b.name, b.kunde, b.ort, b.strasse, b.winworkerNr].some((x) => x.toLowerCase().includes(s)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Seite
      titel="Baustellen"
      aktion={
        admin ? (
          <div className="knopfreihe">
            <Link className="knopf klein" to="/buero/import">
              Aus WinWorker
            </Link>
            <Link className="knopf klein haupt" to="/buero/baustellen/neu">
              Neu
            </Link>
          </div>
        ) : undefined
      }
    >
      <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen nach Name, Kunde, Ort oder Nummer" />
      <JaNein wert={alle} onChange={setAlle} text="Abgeschlossene zeigen" />
      {!liste.length && <Leer>Keine Baustellen gefunden.</Leer>}
      {liste.map((b) => (
        <Link key={b.id} to={admin ? `/buero/baustellen/${b.id}` : `/baustelle/${b.id}`} className="zeile">
          <div className="wachsen">
            <strong>{b.name}</strong>
            <div className="leise-text">{[b.kunde, adresse(b), b.winworkerNr && `WinWorker ${b.winworkerNr}`].filter(Boolean).join(' · ')}</div>
          </div>
          <Marke ton={STATUS[b.status].ton}>{STATUS[b.status].text}</Marke>
        </Link>
      ))}
    </Seite>
  );
}

const LEER: Omit<Baustelle, 'id'> = {
  name: '', kunde: '', strasse: '', plz: '', ort: '', zugang: '', arbeitsbeginn: '', leistung: '', bewohnt: false, denkmalschutz: false, geruest: false,
  notizen: '', status: 'geplant', abgeschlossenAm: null, winworkerNr: ''
};

export function BaustelleBearbeiten() {
  const { id } = useParams();
  const { daten, speichern, loeschen } = useDaten();
  const zeigen = useHinweis();
  const navigate = useNavigate();
  const vorhanden = daten.baustellen.find((b) => b.id === id);
  const [b, setB] = useState<Baustelle>(() => vorhanden ?? { id: neueId(), ...LEER });
  const [neuKontakt, setNeuKontakt] = useState({ name: '', rolle: 'Kunde' as KontaktRolle, telefon: '' });
  const [neuMaterial, setNeuMaterial] = useState({ bezeichnung: '', farbton: '', menge: '' });
  const istNeu = !vorhanden;

  const feld = (k: keyof Baustelle) => ({
    value: (b[k] as string) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setB({ ...b, [k]: e.target.value })
  });

  async function sichern() {
    if (!b.name.trim()) return zeigen('Bitte einen Namen eintragen.', { fehler: true });
    const fertig = b.status === 'abgeschlossen' ? { ...b, abgeschlossenAm: b.abgeschlossenAm ?? new Date().toISOString().slice(0, 10) } : { ...b, abgeschlossenAm: null };
    await speichern('baustellen', fertig);
    zeigen('Baustelle gespeichert.');
    if (istNeu) navigate(`/buero/baustellen/${b.id}`, { replace: true });
  }

  const kontakte = daten.kontakte.filter((k) => k.baustelleId === b.id);
  const material = daten.materialien.filter((m) => m.baustelleId === b.id);

  return (
    <Seite titel={istNeu ? 'Neue Baustelle' : b.name} zurueck="/buero/baustellen" aktion={!istNeu ? <Link className="knopf klein" to={`/baustelle/${b.id}`}>Wie Mitarbeiter</Link> : undefined}>
      <div className="formular">
        <label>
          Name (so heißt sie im Plan)
          <input {...feld('name')} placeholder="zum Beispiel Meier Treppenhaus" />
        </label>
        <label>
          Kunde
          <input {...feld('kunde')} />
        </label>
        <label>
          Straße und Hausnummer
          <input {...feld('strasse')} />
        </label>
        <div className="zwei">
          <label>
            PLZ
            <input {...feld('plz')} inputMode="numeric" />
          </label>
          <label>
            Ort
            <input {...feld('ort')} />
          </label>
        </div>
        <label>
          Zugang, Schlüssel, Parken
          <textarea {...feld('zugang')} rows={2} />
        </label>
        <div className="zwei">
          <label>
            Arbeitsbeginn (Vorschlag)
            <input type="time" {...feld('arbeitsbeginn')} />
          </label>
          <label>
            WinWorker-Nummer
            <input {...feld('winworkerNr')} />
          </label>
        </div>
        <label>
          Was gemacht wird
          <textarea {...feld('leistung')} rows={4} />
        </label>
        <label>
          Hinweise vom Büro
          <textarea {...feld('notizen')} rows={3} />
        </label>
        <div className="marken">
          <JaNein wert={b.bewohnt} onChange={(v) => setB({ ...b, bewohnt: v })} text="Bewohnt" />
          <JaNein wert={b.denkmalschutz} onChange={(v) => setB({ ...b, denkmalschutz: v })} text="Denkmalschutz" />
          <JaNein wert={b.geruest} onChange={(v) => setB({ ...b, geruest: v })} text="Gerüst" />
        </div>
        <label>
          Stand
          <select value={b.status} onChange={(e) => setB({ ...b, status: e.target.value as BaustellenStatus })}>
            {(Object.keys(STATUS) as BaustellenStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].text}
              </option>
            ))}
          </select>
        </label>
        <button className="knopf haupt gross" onClick={sichern}>
          Speichern
        </button>
      </div>

      {!istNeu && (
        <>
          <section>
            <h2>Ansprechpartner</h2>
            {kontakte.map((k) => (
              <div key={k.id} className="zeile">
                <div className="wachsen">
                  <strong>{k.name}</strong>
                  <div className="leise-text">
                    {k.rolle}
                    {k.telefon && ` · ${k.telefon}`}
                  </div>
                </div>
                <button className="knopf klein" onClick={() => void loeschen('kontakte', k.id)}>
                  Entfernen
                </button>
              </div>
            ))}
            <div className="formular reihe">
              <input value={neuKontakt.name} onChange={(e) => setNeuKontakt({ ...neuKontakt, name: e.target.value })} placeholder="Name" />
              <select value={neuKontakt.rolle} onChange={(e) => setNeuKontakt({ ...neuKontakt, rolle: e.target.value as KontaktRolle })}>
                {(['Kunde', 'Bauleitung', 'Hausmeister', 'Sonstige'] as KontaktRolle[]).map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <input value={neuKontakt.telefon} onChange={(e) => setNeuKontakt({ ...neuKontakt, telefon: e.target.value })} placeholder="Telefon" inputMode="tel" />
              <button
                className="knopf"
                disabled={!neuKontakt.name.trim()}
                onClick={async () => {
                  await speichern('kontakte', { id: neueId(), baustelleId: b.id, ...neuKontakt, name: neuKontakt.name.trim() });
                  setNeuKontakt({ name: '', rolle: 'Kunde', telefon: '' });
                }}
              >
                Hinzufügen
              </button>
            </div>
          </section>

          <section>
            <h2>Material und Farbtöne</h2>
            {material.map((m) => (
              <div key={m.id} className="zeile">
                <div className="wachsen">
                  <strong>{m.bezeichnung}</strong>
                  <div className="leise-text">{[m.farbton, m.menge].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="knopf klein" onClick={() => void loeschen('materialien', m.id)}>
                  Entfernen
                </button>
              </div>
            ))}
            <div className="formular reihe">
              <input value={neuMaterial.bezeichnung} onChange={(e) => setNeuMaterial({ ...neuMaterial, bezeichnung: e.target.value })} placeholder="Material" />
              <input value={neuMaterial.farbton} onChange={(e) => setNeuMaterial({ ...neuMaterial, farbton: e.target.value })} placeholder="Farbton" />
              <input value={neuMaterial.menge} onChange={(e) => setNeuMaterial({ ...neuMaterial, menge: e.target.value })} placeholder="Menge" />
              <button
                className="knopf"
                disabled={!neuMaterial.bezeichnung.trim()}
                onClick={async () => {
                  await speichern('materialien', { id: neueId(), baustelleId: b.id, ...neuMaterial });
                  setNeuMaterial({ bezeichnung: '', farbton: '', menge: '' });
                }}
              >
                Hinzufügen
              </button>
            </div>
          </section>
        </>
      )}
    </Seite>
  );
}
