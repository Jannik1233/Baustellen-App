import { useRef, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDateiUrl } from '../lib/daten';
import { Symbol, type SymbolName } from './Symbol';

export function Seite({ titel, zurueck, aktion, children }: { titel: string; zurueck?: string | true; aktion?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="seite">
      <header className="seiten-kopf">
        {zurueck && (
          <button className="zurueck" aria-label="Zurück" onClick={() => (zurueck === true ? navigate(-1) : navigate(zurueck))}>
            ‹
          </button>
        )}
        <h1>{titel}</h1>
        {aktion && <div className="seiten-aktion">{aktion}</div>}
      </header>
      {children}
    </div>
  );
}

export function Kachel({ zu, onClick, titel, unter, ton, symbol }: { zu?: string; onClick?: () => void; titel: string; unter?: string; ton?: 'rot' | 'gelb' | 'gruen' | 'blau'; symbol?: SymbolName }) {
  const inhalt = (
    <>
      {symbol && (
        <span className="kachel-symbol">
          <Symbol name={symbol} groesse={30} />
        </span>
      )}
      <span className="kachel-titel">{titel}</span>
      {unter && <span className="kachel-unter">{unter}</span>}
    </>
  );
  const klasse = `kachel ${ton ?? ''}`;
  return zu ? <Link className={klasse} to={zu}>{inhalt}</Link> : <button className={klasse} onClick={onClick}>{inhalt}</button>;
}

export function Leer({ children }: { children: ReactNode }) {
  return <p className="leer">{children}</p>;
}

export function Marke({ ton, children }: { ton: 'rot' | 'gelb' | 'gruen' | 'grau' | 'blau'; children: ReactNode }) {
  return <span className={`marke ${ton}`}>{children}</span>;
}

export function DateiBild({ pfad, alt, klein }: { pfad: string | null | undefined; alt: string; klein?: boolean }) {
  const url = useDateiUrl(pfad);
  if (!pfad) return null;
  if (!url) return <div className={`bild-platz ${klein ? 'klein' : ''}`}>Bild wird geladen</div>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img className={`bild ${klein ? 'klein' : ''}`} src={url} alt={alt} loading="lazy" />
    </a>
  );
}

// Öffnet direkt die Kamera (auf dem Handy) bzw. die Dateiauswahl (am PC)
export function KameraKnopf({ onFoto, children, klasse = 'knopf' }: { onFoto: (datei: File) => void; children: ReactNode; klasse?: string }) {
  const eingabe = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={klasse} onClick={() => eingabe.current?.click()}>
        {children}
      </button>
      <input
        ref={eingabe}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const datei = e.target.files?.[0];
          e.target.value = '';
          if (datei) onFoto(datei);
        }}
      />
    </>
  );
}

export function JaNein({ wert, onChange, text }: { wert: boolean; onChange: (v: boolean) => void; text: string }) {
  return (
    <label className="haken">
      <input type="checkbox" checked={wert} onChange={(e) => onChange(e.target.checked)} />
      {text}
    </label>
  );
}
