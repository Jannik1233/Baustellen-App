import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { VERZOEGERUNG_MS } from '../lib/daten';

// Kurze Rückmeldung unten am Bildschirm, wahlweise mit "Rückgängig".
// Statt "Wirklich senden?" wird sofort gesendet und 5 Sekunden lang Rückgängig angeboten. Das spart einen Tap.

interface Hinweis {
  text: string;
  rueckgaengig?: () => void;
  art: 'ok' | 'fehler';
}

const Kontext = createContext<(text: string, optionen?: { rueckgaengig?: () => void; fehler?: boolean }) => void>(() => undefined);

// Etwas kürzer als die Sendeverzögerung, damit Rückgängig sicher vor dem Senden kommt
export const RUECKGAENGIG_MS = VERZOEGERUNG_MS - 500;

export function HinweisProvider({ children }: { children: ReactNode }) {
  const [hinweis, setHinweis] = useState<Hinweis | null>(null);
  const timer = useRef<number>();

  const zeigen = useCallback((text: string, optionen?: { rueckgaengig?: () => void; fehler?: boolean }) => {
    window.clearTimeout(timer.current);
    setHinweis({ text, rueckgaengig: optionen?.rueckgaengig, art: optionen?.fehler ? 'fehler' : 'ok' });
    timer.current = window.setTimeout(() => setHinweis(null), optionen?.rueckgaengig ? RUECKGAENGIG_MS : 3500);
  }, []);

  return (
    <Kontext.Provider value={zeigen}>
      {children}
      {hinweis && (
        <div className={`hinweis ${hinweis.art}`} role="status">
          <span>{hinweis.text}</span>
          {hinweis.rueckgaengig && (
            <button
              className="hinweis-knopf"
              onClick={() => {
                hinweis.rueckgaengig?.();
                setHinweis(null);
              }}
            >
              Rückgängig
            </button>
          )}
        </div>
      )}
    </Kontext.Provider>
  );
}

export const useHinweis = () => useContext(Kontext);
