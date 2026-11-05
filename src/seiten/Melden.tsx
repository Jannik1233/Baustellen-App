import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { KameraKnopf, Seite } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { Symbol } from '../komponenten/Symbol';
import { useHeutigeBaustelle } from '../lib/ansicht';
import { fotoVerkleinern, lieferscheinAufbereiten } from '../lib/bild';
import { neueId, useDaten, useSichtbareBaustellen } from '../lib/daten';
import { bisNachArbeitstagen, datumKurz, heuteIso, montagDerWoche, plusTage, wochentag } from '../lib/regeln';
import { naechsterArbeitstag } from '../lib/arbeitstage';
import type { Meldung } from '../lib/types';

// Alle Meldungen gehen ohne Rückfrage raus. Danach gibt es 5 Sekunden lang "Rückgängig".

function BlobBild({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className="bild klein" src={url} alt={alt} />;
}

// Auswahl der Baustelle als große Knöpfe. Vorausgewählt ist die Baustelle, auf der man heute ist.
function BaustellenWahl({ wert, onChange, ohne = true }: { wert: string | null; onChange: (id: string | null) => void; ohne?: boolean }) {
  const sichtbar = useSichtbareBaustellen();
  const heutige = useHeutigeBaustelle();
  const liste = [...sichtbar].filter((b) => b.status !== 'abgeschlossen').sort((a, b) => (a.id === heutige ? -1 : b.id === heutige ? 1 : a.name.localeCompare(b.name)));
  return (
    <div className="wahl">
      {liste.map((b) => (
        <button key={b.id} type="button" className={wert === b.id ? 'an' : ''} onClick={() => onChange(b.id)}>
          {b.name}
        </button>
      ))}
      {ohne && (
        <button type="button" className={wert === null ? 'an' : ''} onClick={() => onChange(null)}>
          Ohne Baustelle
        </button>
      )}
    </div>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="abschnitt">
      <h2>{titel}</h2>
      {children}
    </section>
  );
}

function useMeldungSenden() {
  const { benutzer, speichern, dateiSpeichern, rueckgaengig } = useDaten();
  const zeigen = useHinweis();
  const navigate = useNavigate();
  return async (teil: Partial<Meldung> & Pick<Meldung, 'art'>, foto: Blob | null, text: string) => {
    const id = neueId();
    const nummern: number[] = [];
    let fotoPfad: string | null = null;
    if (foto) {
      fotoPfad = `meldung/${id}/foto.jpg`;
      nummern.push(await dateiSpeichern(fotoPfad, await fotoVerkleinern(foto), { verzoegert: true }));
    }
    const meldung: Meldung = {
      id,
      melderId: benutzer!.id,
      baustelleId: null,
      maschineId: null,
      arbeitSteht: false,
      material: '',
      menge: '',
      benoetigtBis: null,
      beschreibung: '',
      fotoPfad,
      status: 'offen',
      erstelltAm: new Date().toISOString(),
      erledigtAm: null,
      ...teil
    };
    nummern.push(await speichern('meldungen', meldung, { verzoegert: true }));
    navigate('/');
    zeigen(text, {
      rueckgaengig: async () => {
        const ok = await rueckgaengig(nummern, 'meldungen', id);
        zeigen(ok ? 'Meldung zurückgenommen.' : 'Die Meldung war schon unterwegs. Bitte kurz im Büro Bescheid geben.', { fehler: !ok });
      }
    });
  };
}

export function LieferscheinMelden() {
  const { benutzer, speichern, dateiSpeichern, rueckgaengig } = useDaten();
  const heutige = useHeutigeBaustelle();
  const zeigen = useHinweis();
  const navigate = useNavigate();
  const [seiten, setSeiten] = useState<Blob[]>([]);
  const [baustelle, setBaustelle] = useState<string | null>(heutige);
  const [lieferant, setLieferant] = useState('');
  const [arbeitet, setArbeitet] = useState(false);

  async function seiteDazu(datei: File) {
    setArbeitet(true);
    try {
      const bild = await lieferscheinAufbereiten(datei);
      setSeiten((s) => [...s, bild]);
    } finally {
      setArbeitet(false);
    }
  }

  async function senden() {
    const id = neueId();
    const nummern: number[] = [];
    const pfade: string[] = [];
    for (const [i, s] of seiten.entries()) {
      const pfad = `lieferschein/${id}/seite-${i + 1}.jpg`;
      nummern.push(await dateiSpeichern(pfad, s, { verzoegert: true }));
      pfade.push(pfad);
    }
    nummern.push(
      await speichern(
        'lieferscheine',
        { id, baustelleId: baustelle, datum: heuteIso(), lieferant: lieferant.trim(), seiten: pfade, status: 'offen', erfasstVon: benutzer!.id, erfasstAm: new Date().toISOString() },
        { verzoegert: true }
      )
    );
    navigate('/');
    zeigen('Lieferschein gesendet.', {
      rueckgaengig: async () => {
        const ok = await rueckgaengig(nummern, 'lieferscheine', id);
        zeigen(ok ? 'Lieferschein zurückgenommen.' : 'Der Lieferschein war schon unterwegs.', { fehler: !ok });
      }
    });
  }

  return (
    <Seite titel="Lieferschein" zurueck="/">
      {!seiten.length ? (
        <>
          <p>Lieferschein flach hinlegen, gut ausleuchten, ganz aufs Bild.</p>
          <KameraKnopf onFoto={seiteDazu} klasse="knopf haupt riesig">
            <Symbol name="kamera" groesse={34} />
            {arbeitet ? 'Wird aufbereitet' : 'Foto machen'}
          </KameraKnopf>
        </>
      ) : (
        <>
          <div className="foto-raster">
            {seiten.map((s, i) => (
              <figure key={i}>
                <BlobBild blob={s} alt={`Seite ${i + 1}`} />
                <figcaption>
                  Seite {i + 1}{' '}
                  <button className="link" onClick={() => setSeiten((alt) => alt.filter((_, j) => j !== i))}>
                    entfernen
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          <KameraKnopf onFoto={seiteDazu}>
            <Symbol name="plus" /> {arbeitet ? 'Wird aufbereitet' : 'Weitere Seite'}
          </KameraKnopf>
          <Abschnitt titel="Baustelle">
            <BaustellenWahl wert={baustelle} onChange={setBaustelle} />
          </Abschnitt>
          <Abschnitt titel="Lieferant (wenn schnell zur Hand)">
            <input value={lieferant} onChange={(e) => setLieferant(e.target.value)} placeholder="zum Beispiel Farbenhandel" />
          </Abschnitt>
          <button className="knopf haupt riesig" disabled={arbeitet} onClick={senden}>
            Senden
          </button>
        </>
      )}
    </Seite>
  );
}

type Bedarf = 'heute' | 'morgen' | 'woche';

export function MaterialMelden() {
  const { daten } = useDaten();
  const heutige = useHeutigeBaustelle();
  const senden = useMeldungSenden();
  const [baustelle, setBaustelle] = useState<string | null>(heutige);
  const [material, setMaterial] = useState('');
  const [menge, setMenge] = useState('');
  const [bedarf, setBedarf] = useState<Bedarf>('morgen');
  const [foto, setFoto] = useState<Blob | null>(null);

  const vorschlaege = daten.materialien.filter((m) => m.baustelleId === baustelle);
  const heute = heuteIso();
  const bis: Record<Bedarf, string> = {
    heute,
    morgen: naechsterArbeitstag(plusTage(heute, 1)),
    woche: plusTage(montagDerWoche(heute), 4)
  };

  return (
    <Seite titel="Material" zurueck="/">
      <Abschnitt titel="Was fehlt?">
        {vorschlaege.length > 0 && (
          <div className="wahl">
            {vorschlaege.map((m) => {
              const text = [m.bezeichnung, m.farbton].filter(Boolean).join(', ');
              return (
                <button key={m.id} type="button" className={material === text ? 'an' : ''} onClick={() => setMaterial(text)}>
                  {text}
                </button>
              );
            })}
          </div>
        )}
        <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Material, Farbton" />
        <input value={menge} onChange={(e) => setMenge(e.target.value)} placeholder="Menge (wenn bekannt)" />
      </Abschnitt>
      <Abschnitt titel="Gebraucht bis">
        <div className="wahl">
          {(['heute', 'morgen', 'woche'] as Bedarf[]).map((b) => (
            <button key={b} type="button" className={bedarf === b ? 'an' : ''} onClick={() => setBedarf(b)}>
              {b === 'heute' ? 'Heute' : b === 'morgen' ? `${wochentag(bis.morgen)}` : 'Diese Woche'}
            </button>
          ))}
        </div>
      </Abschnitt>
      <Abschnitt titel="Baustelle">
        <BaustellenWahl wert={baustelle} onChange={setBaustelle} />
      </Abschnitt>
      <KameraKnopf onFoto={setFoto}>
        <Symbol name="kamera" /> {foto ? 'Anderes Foto' : 'Foto dazu (Etikett, Eimer)'}
      </KameraKnopf>
      {foto && <BlobBild blob={foto} alt="Foto zur Meldung" />}
      <button
        className="knopf haupt riesig"
        disabled={!material.trim()}
        onClick={() =>
          senden(
            { art: 'material', baustelleId: baustelle, material: material.trim(), menge: menge.trim(), benoetigtBis: bis[bedarf] < heute ? heute : bis[bedarf] },
            foto,
            'Materialmeldung gesendet.'
          )
        }
      >
        Senden
      </button>
    </Seite>
  );
}

export function MaschineMelden() {
  const { daten } = useDaten();
  const heutige = useHeutigeBaustelle();
  const senden = useMeldungSenden();
  const [maschine, setMaschine] = useState<string | null | undefined>(undefined); // null = nicht in der Liste
  const [beschreibung, setBeschreibung] = useState('');
  const [foto, setFoto] = useState<Blob | null>(null);

  // Maschinen auf der heutigen Baustelle zuerst
  const liste = [...daten.maschinen].sort((a, b) => {
    const ah = a.standortBaustelleId === heutige ? 0 : 1;
    const bh = b.standortBaustelleId === heutige ? 0 : 1;
    return ah - bh || a.bezeichnung.localeCompare(b.bezeichnung);
  });

  const melden = (arbeitSteht: boolean) =>
    senden(
      { art: 'maschine', maschineId: maschine ?? null, baustelleId: heutige, arbeitSteht, beschreibung: beschreibung.trim() },
      foto,
      arbeitSteht ? 'Gemeldet: Arbeit steht. Das Büro meldet sich.' : 'Maschinenmeldung gesendet.'
    );

  return (
    <Seite titel="Maschine" zurueck="/">
      <Abschnitt titel="Welche Maschine?">
        <div className="wahl">
          {liste.map((m) => (
            <button key={m.id} type="button" className={maschine === m.id ? 'an' : ''} onClick={() => setMaschine(m.id)}>
              {m.bezeichnung}
              {m.standortBaustelleId === heutige && heutige ? <small>hier auf der Baustelle</small> : null}
            </button>
          ))}
          <button type="button" className={maschine === null ? 'an' : ''} onClick={() => setMaschine(null)}>
            Nicht in der Liste
          </button>
        </div>
      </Abschnitt>
      {maschine !== undefined && (
        <>
          <Abschnitt titel="Was ist los? (freiwillig)">
            <input value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} placeholder={maschine === null ? 'Welche Maschine, was ist los?' : 'zum Beispiel springt nicht an'} />
            <KameraKnopf onFoto={setFoto}>
              <Symbol name="kamera" /> {foto ? 'Anderes Foto' : 'Foto dazu'}
            </KameraKnopf>
            {foto && <BlobBild blob={foto} alt="Foto zur Meldung" />}
          </Abschnitt>
          <div className="stapel">
            <button className="knopf rot riesig" disabled={maschine === null && !beschreibung.trim()} onClick={() => melden(true)}>
              Arbeit steht
            </button>
            <button className="knopf riesig" disabled={maschine === null && !beschreibung.trim()} onClick={() => melden(false)}>
              Läuft noch, bitte ansehen
            </button>
          </div>
        </>
      )}
    </Seite>
  );
}

export function KrankMelden() {
  const { benutzer, speichern, rueckgaengig } = useDaten();
  const zeigen = useHinweis();
  const navigate = useNavigate();
  const heute = heuteIso();
  const erster = naechsterArbeitstag(heute);
  const zweiter = naechsterArbeitstag(plusTage(erster, 1));
  // Nach Feierabend gilt die Meldung meist für den nächsten Arbeitstag
  const [ab, setAb] = useState(erster === heute && new Date().getHours() >= 16 ? zweiter : erster);

  async function melden(tage: number | null) {
    const id = neueId();
    const bis = tage ? bisNachArbeitstagen(ab, tage) : null;
    const nr = await speichern('krankmeldungen', { id, personId: benutzer!.id, ab, bisVoraussichtlich: bis, gemeldetAm: new Date().toISOString() }, { verzoegert: true });
    navigate('/');
    zeigen('Krankmeldung gesendet. Gute Besserung!', {
      rueckgaengig: async () => {
        const ok = await rueckgaengig([nr], 'krankmeldungen', id);
        zeigen(ok ? 'Krankmeldung zurückgenommen.' : 'Die Meldung war schon unterwegs. Bitte kurz im Büro anrufen.', { fehler: !ok });
      }
    });
  }

  return (
    <Seite titel="Krank melden" zurueck="/">
      <p>Du musst keinen Grund angeben. Ab wann und wie lange ungefähr?</p>
      <div className="umschalter">
        {[erster, zweiter].map((tag) => (
          <button key={tag} className={ab === tag ? 'an' : ''} onClick={() => setAb(tag)}>
            {tag === heute ? 'Ab heute' : `Ab ${wochentag(tag)}`}
          </button>
        ))}
      </div>
      <div className="stapel">
        <button className="knopf haupt riesig" onClick={() => melden(1)}>
          1 Tag
        </button>
        <button className="knopf riesig" onClick={() => melden(3)}>
          Bis {wochentag(bisNachArbeitstagen(ab, 3))}, {datumKurz(bisNachArbeitstagen(ab, 3))}
        </button>
        <button className="knopf riesig" onClick={() => melden(null)}>
          Weiß ich noch nicht
        </button>
      </div>
      <p className="leise-text">
        Wenn es länger dauert, melde dich einfach noch einmal. Die Krankschreibung vom Arzt ruft das Büro elektronisch bei deiner Krankenkasse ab. Ab wann du eine brauchst, steht in deinem
        Arbeitsvertrag.
      </p>
    </Seite>
  );
}
