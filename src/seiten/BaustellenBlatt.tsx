import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DateiBild, KameraKnopf, Leer, Marke, Seite } from '../komponenten/Bausteine';
import { useHinweis } from '../komponenten/Hinweis';
import { Symbol } from '../komponenten/Symbol';
import { useNamen, zeitpunkt } from '../lib/ansicht';
import { fotoVerkleinern } from '../lib/bild';
import { istAdmin, neueId, useDaten, useSichtbareBaustellen } from '../lib/daten';
import { DokumentZeile } from './Dokumente';
import { adresse, navigationsLink, telefonLink } from '../lib/regeln';
import type { FotoArt } from '../lib/types';

const FOTO_TEXT: Record<FotoArt, string> = { ist: 'Vorher', fortschritt: 'Fortschritt', mangel: 'Mangel' };

export function BaustellenBlatt() {
  const { id } = useParams();
  const { daten, benutzer, speichern, dateiSpeichern } = useDaten();
  const sichtbar = useSichtbareBaustellen();
  const namen = useNamen();
  const zeigen = useHinweis();
  const [fotoArt, setFotoArt] = useState<FotoArt>('fortschritt');
  const b = sichtbar.find((x) => x.id === id);

  if (!b || !benutzer)
    return (
      <Seite titel="Baustelle" zurueck>
        <Leer>Diese Baustelle ist für dich gerade nicht freigegeben. Sichtbar sind Baustellen, auf denen du in den letzten zwei oder nächsten vier Wochen eingeplant bist.</Leer>
      </Seite>
    );

  const kontakte = daten.kontakte.filter((k) => k.baustelleId === b.id);
  const material = daten.materialien.filter((m) => m.baustelleId === b.id);
  const dokumente = daten.dokumente.filter((d) => d.baustelleId === b.id);
  const fotos = daten.fotos.filter((f) => f.baustelleId === b.id).sort((x, y) => y.erstelltAm.localeCompare(x.erstelltAm));
  const hinweise = [b.bewohnt && 'Bewohnt', b.denkmalschutz && 'Denkmalschutz', b.geruest && 'Gerüst'].filter(Boolean) as string[];

  async function fotoAufnehmen(datei: File) {
    const fotoId = neueId();
    const pfad = `baustelle/${b!.id}/${fotoId}.jpg`;
    await dateiSpeichern(pfad, await fotoVerkleinern(datei));
    await speichern('fotos', { id: fotoId, baustelleId: b!.id, art: fotoArt, pfad, notiz: '', erstelltVon: benutzer!.id, erstelltAm: new Date().toISOString() });
    zeigen('Foto gespeichert.');
  }

  return (
    <Seite titel={b.name} zurueck aktion={istAdmin(benutzer) ? <Link className="knopf klein" to={`/buero/baustellen/${b.id}`}>Bearbeiten</Link> : undefined}>
      <div className="karte">
        <div className="feld-titel">Adresse</div>
        <div className="gross-text">{adresse(b) || 'Keine Adresse hinterlegt'}</div>
        {b.kunde && <div className="leise-text">Kunde: {b.kunde}</div>}
        {adresse(b) && (
          <a className="knopf haupt" href={navigationsLink(b)} target="_blank" rel="noreferrer">
            <Symbol name="navigation" /> Navigation starten
          </a>
        )}
      </div>

      {(hinweise.length > 0 || b.zugang || b.arbeitsbeginn) && (
        <div className="karte">
          {hinweise.length > 0 && (
            <div className="marken">
              {hinweise.map((h) => (
                <Marke key={h} ton="gelb">
                  {h}
                </Marke>
              ))}
            </div>
          )}
          {b.arbeitsbeginn && (
            <p>
              <strong>Arbeitsbeginn:</strong> {b.arbeitsbeginn} Uhr
            </p>
          )}
          {b.zugang && (
            <p>
              <strong>Zugang, Schlüssel, Parken:</strong> {b.zugang}
            </p>
          )}
        </div>
      )}

      {kontakte.length > 0 && (
        <section>
          <h2>Ansprechpartner</h2>
          {kontakte.map((k) => (
            <div key={k.id} className="zeile">
              <div>
                <strong>{k.name}</strong>
                <div className="leise-text">{k.rolle}</div>
              </div>
              {k.telefon && (
                <a className="knopf" href={telefonLink(k.telefon)}>
                  <Symbol name="telefon" /> Anrufen
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      {b.leistung && (
        <section>
          <h2>Was gemacht wird</h2>
          <div className="karte vorformatiert">{b.leistung}</div>
        </section>
      )}

      {material.length > 0 && (
        <section>
          <h2>Material und Farbtöne</h2>
          {material.map((m) => (
            <div key={m.id} className="zeile">
              <div>
                <strong>{m.bezeichnung}</strong>
                {m.farbton && <div>Farbton: {m.farbton}</div>}
              </div>
              {m.menge && <span className="leise-text">{m.menge}</span>}
            </div>
          ))}
        </section>
      )}

      {b.notizen && (
        <section>
          <h2>Hinweise vom Büro</h2>
          <div className="karte vorformatiert">{b.notizen}</div>
        </section>
      )}

      {dokumente.length > 0 && (
        <section>
          <h2>Unterlagen</h2>
          {dokumente.map((d) => (
            <DokumentZeile key={d.id} dokument={d} />
          ))}
        </section>
      )}

      <section>
        <h2>Fotos</h2>
        <div className="umschalter klein">
          {(Object.keys(FOTO_TEXT) as FotoArt[]).map((a) => (
            <button key={a} className={fotoArt === a ? 'an' : ''} onClick={() => setFotoArt(a)}>
              {FOTO_TEXT[a]}
            </button>
          ))}
        </div>
        <KameraKnopf onFoto={fotoAufnehmen} klasse="knopf gross">
          <Symbol name="kamera" /> Foto machen
        </KameraKnopf>
        <div className="foto-raster">
          {fotos.map((f) => (
            <figure key={f.id}>
              <DateiBild pfad={f.pfad} alt={FOTO_TEXT[f.art]} klein />
              <figcaption>
                {FOTO_TEXT[f.art]}, {namen.person(f.erstelltVon).split(' ')[0]}, {zeitpunkt(f.erstelltAm)}
              </figcaption>
            </figure>
          ))}
        </div>
        {!fotos.length && <Leer>Noch keine Fotos.</Leer>}
      </section>
    </Seite>
  );
}
