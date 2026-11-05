import { useState } from 'react';
import { useDaten } from '../lib/daten';
import { demoAnmelden, demoPersonen } from '../lib/demoQuelle';
import { codePruefen, codeSenden } from '../lib/supabaseQuelle';

const ROLLE_TEXT = { admin: 'Chef, plant und genehmigt', buero: 'Büro, bearbeitet Meldungen', mitarbeiter: 'Baustelle' };

export function Anmelden() {
  const { quelle, neuLaden } = useDaten();
  return (
    <div className="anmelden">
      <div className="anmelden-karte">
        <img src="/logo.png" alt="Maler GmbH Frohes Schaffen" className="anmelden-logo" />
        <p className="leise-text">Baustellen-App · Malerbetrieb seit 1958</p>
        {quelle.modus === 'demo' ? <DemoAnmeldung weiter={neuLaden} /> : <CodeAnmeldung weiter={neuLaden} />}
      </div>
    </div>
  );
}

function DemoAnmeldung({ weiter }: { weiter: () => Promise<void> }) {
  return (
    <>
      <p>Demo-Modus zum Ausprobieren. Als wer möchtest du die App ansehen?</p>
      <div className="stapel">
        {demoPersonen().map((p) => (
          <button
            key={p.id}
            className="knopf gross"
            onClick={() => {
              demoAnmelden(p.id);
              void weiter();
            }}
          >
            <span>{p.name}</span>
            <small>{p.azubi ? 'Azubi, Baustelle' : ROLLE_TEXT[p.rolle]}</small>
          </button>
        ))}
      </div>
    </>
  );
}

function CodeAnmeldung({ weiter }: { weiter: () => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    const f = await codeSenden(email.trim());
    setLaeuft(false);
    if (f) setFehler(f);
    else setGesendet(true);
  }

  async function pruefen(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    const f = await codePruefen(email.trim(), code);
    setLaeuft(false);
    if (f) setFehler(f);
    else await weiter();
  }

  if (!gesendet)
    return (
      <form onSubmit={senden} className="stapel">
        <p>Bitte die E-Mail-Adresse eingeben, die im Büro hinterlegt ist. Du bekommst dann einen Code.</p>
        <input type="email" autoComplete="email" inputMode="email" required placeholder="name@beispiel.de" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="knopf haupt gross" disabled={laeuft}>
          {laeuft ? 'Wird gesendet' : 'Code schicken'}
        </button>
        {fehler && <p className="fehlertext">{fehler}</p>}
      </form>
    );

  return (
    <form onSubmit={pruefen} className="stapel">
      <p>Wir haben einen 6-stelligen Code an {email} geschickt. Bitte hier eintragen.</p>
      <input
        className="code-feld"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      <button className="knopf haupt gross" disabled={laeuft || code.length !== 6}>
        Anmelden
      </button>
      <button type="button" className="knopf flach" onClick={() => setGesendet(false)}>
        Andere E-Mail-Adresse
      </button>
      {fehler && <p className="fehlertext">{fehler}</p>}
    </form>
  );
}
