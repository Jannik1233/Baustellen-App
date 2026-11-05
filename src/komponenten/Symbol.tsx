// Einfache Strichsymbole als SVG. Bewusst keine Emojis, die auf jedem Handy anders aussehen.

const PFADE = {
  heute: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  woche: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  liste: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  mehr: 'M4 7h16M4 12h16M4 17h16',
  eingang: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  baustelle: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  lieferschein: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  material: 'M5 8h14l-1 12H6zM9 8V5h6v3',
  maschine: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  krank: 'M4 12h16M12 4v16',
  urlaub: 'M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8zM12 12v8M9 20h6',
  dokument: 'M3 7h6l2 2h10v10H3z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',
  einstellungen: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  warnung: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  haken: 'M5 12l5 5 9-10',
  kamera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 11a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  telefon: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z',
  navigation: 'M3 11l18-8-8 18-2-8z',
  plus: 'M12 5v14M5 12h14',
  pfeil: 'M9 6l6 6-6 6',
  uhr: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2'
} as const;

export type SymbolName = keyof typeof PFADE;

export function Symbol({ name, groesse = 22 }: { name: SymbolName; groesse?: number }) {
  return (
    <svg
      className="symbol"
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PFADE[name]} />
    </svg>
  );
}
