import { useState } from 'react';
import { JaNein, Marke, Seite } from '../../komponenten/Bausteine';
import { useHinweis } from '../../komponenten/Hinweis';
import { neueId, useDaten } from '../../lib/daten';
import { datumKurz, heuteIso } from '../../lib/regeln';
import { zugangAnlegen } from '../../lib/supabaseQuelle';
import type { Person, Rolle } from '../../lib/types';

const ROLLE_TEXT: Record<Rolle, string> = { admin: 'Chef (plant, genehmigt, verwaltet)', buero: 'Büro (Meldungen und Lieferscheine)', mitarbeiter: 'Baustelle' };

const LEER: Omit<Person, 'id'> = { name: '', email: '', telefon: '', rolle: 'mitarbeiter', imPlan: true, azubi: false, jugendlichBis: null, aktivBis: null, winworkerNr: '' };

export function Personen() {
  const { daten } = useDaten();
  const [offen, setOffen] = useState<string | null>(null);
  const heute = heuteIso();
  const liste = [...daten.personen].sort((a, b) => Number(Boolean(a.aktivBis && a.aktivBis < heute)) - Number(Boolean(b.aktivBis && b.aktivBis < heute)) || a.name.localeCompare(b.name));

  return (
    <Seite titel="Personen" aktion={<button className="knopf klein haupt" onClick={() => setOffen('neu')}>Neue Person</button>}>
      <p className="leise-text">
        Für jede Person wird nur gespeichert, was die App braucht. Statt des Geburtsdatums nur der Tag des 18. Geburtstags, damit die App bis dahin auf den Jugendarbeitsschutz achtet.
      </p>
      {offen === 'neu' && <PersonFormular key="neu" person={{ id: neueId(), ...LEER }} fertig={() => setOffen(null)} />}
      {liste.map((p) =>
        offen === p.id ? (
          <PersonFormular key={p.id} person={p} fertig={() => setOffen(null)} />
        ) : (
          <button key={p.id} className="zeile zeile-knopf" onClick={() => setOffen(p.id)}>
            <span className="wachsen">
              <strong>{p.name}</strong>
              <span className="leise-text">
                {ROLLE_TEXT[p.rolle]}
                {p.email && ` · ${p.email}`}
              </span>
            </span>
            {p.azubi && <Marke ton="blau">Azubi</Marke>}
            {p.jugendlichBis && p.jugendlichBis > heute && <Marke ton="gelb">unter 18</Marke>}
            {p.aktivBis && <Marke ton={p.aktivBis < heute ? 'grau' : 'gelb'}>bis {datumKurz(p.aktivBis)}</Marke>}
          </button>
        )
      )}
    </Seite>
  );
}

function PersonFormular({ person, fertig }: { person: Person; fertig: () => void }) {
  const { daten, speichern, quelle } = useDaten();
  const zeigen = useHinweis();
  const [p, setP] = useState(person);
  const [laeuft, setLaeuft] = useState(false);
  const istNeu = !daten.personen.some((x) => x.id === person.id);

  async function sichern() {
    if (!p.name.trim()) return zeigen('Bitte einen Namen eintragen.', { fehler: true });
    const email = p.email.trim().toLowerCase();
    if (email && daten.personen.some((x) => x.id !== p.id && x.email.toLowerCase() === email)) return zeigen('Diese E-Mail-Adresse hat schon jemand anderes.', { fehler: true });
    await speichern('personen', { ...p, name: p.name.trim(), email, telefon: p.telefon.trim(), winworkerNr: (p.winworkerNr ?? '').trim() });
    zeigen('Gespeichert.');
    fertig();
  }

  async function zugang() {
    if (quelle.modus === 'demo') return zeigen('Im Demo-Modus gibt es keine Anmeldung per E-Mail.', { fehler: true });
    setLaeuft(true);
    const f = await zugangAnlegen(p.email.trim().toLowerCase());
    setLaeuft(false);
    zeigen(f ?? `Zugang angelegt. ${p.name.split(' ')[0]} kann sich jetzt mit dieser E-Mail-Adresse anmelden.`, { fehler: Boolean(f) });
  }

  return (
    <div className="karte formular">
      <label>
        Name
        <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </label>
      <div className="zwei">
        <label>
          E-Mail (für die Anmeldung)
          <input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
        </label>
        <label>
          Telefon (für Kollegen sichtbar)
          <input inputMode="tel" value={p.telefon} onChange={(e) => setP({ ...p, telefon: e.target.value })} />
        </label>
      </div>
      <label>
        Mitarbeiter-Index in WinWorker (für den Stunden-Export)
        <input inputMode="numeric" value={p.winworkerNr ?? ''} onChange={(e) => setP({ ...p, winworkerNr: e.target.value })} />
      </label>
      <label>
        Rolle
        <select value={p.rolle} onChange={(e) => setP({ ...p, rolle: e.target.value as Rolle })}>
          {(Object.keys(ROLLE_TEXT) as Rolle[]).map((r) => (
            <option key={r} value={r}>
              {ROLLE_TEXT[r]}
            </option>
          ))}
        </select>
      </label>
      <div className="marken">
        <JaNein wert={p.imPlan} onChange={(v) => setP({ ...p, imPlan: v })} text="Erscheint im Wochenplan" />
        <JaNein wert={p.azubi} onChange={(v) => setP({ ...p, azubi: v })} text="Azubi" />
      </div>
      <div className="zwei">
        <label>
          18. Geburtstag am (nur bei unter 18)
          <input type="date" value={p.jugendlichBis ?? ''} onChange={(e) => setP({ ...p, jugendlichBis: e.target.value || null })} />
        </label>
        <label>
          Zugang endet am (zum Beispiel Ende der Probezeit oder des Einsatzes)
          <input type="date" value={p.aktivBis ?? ''} onChange={(e) => setP({ ...p, aktivBis: e.target.value || null })} />
        </label>
      </div>
      <p className="leise-text">90 Tage nach dem Ende des Zugangs löscht die App die Person mit ihren Einträgen automatisch.</p>
      <div className="knopfreihe">
        <button className="knopf haupt" onClick={sichern}>
          Speichern
        </button>
        {!istNeu && p.email && (
          <button className="knopf" disabled={laeuft} onClick={zugang}>
            {laeuft ? 'Wird angelegt' : 'Anmeldung freischalten'}
          </button>
        )}
        <button className="knopf flach" onClick={fertig}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
