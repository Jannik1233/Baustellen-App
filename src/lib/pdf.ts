// Mehrere Lieferscheine als ein PDF, eine Seite je Bild, mit Baustelle und Datum oben.


export interface PdfSeite {
  ueberschrift: string;
  bild: Blob; // JPEG
}

export async function lieferscheinPdf(seiten: PdfSeite[]): Promise<Blob> {
  // Erst bei Bedarf laden, damit die App auf dem Handy schnell startet
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const schrift = await pdf.embedFont(StandardFonts.Helvetica);
  const A4 = { b: 595.28, h: 841.89 };
  const rand = 28;
  for (const s of seiten) {
    const jpg = await pdf.embedJpg(new Uint8Array(await s.bild.arrayBuffer()));
    const seite = pdf.addPage([A4.b, A4.h]);
    // Standardschrift kennt nur WinAnsi-Zeichen; Umlaute gehen, anderes wird ersetzt
    const text = s.ueberschrift.replace(/[^\x20-\x7E -ÿ]/g, '?');
    seite.drawText(text, { x: rand, y: A4.h - rand - 10, size: 11, font: schrift, color: rgb(0.1, 0.1, 0.1) });
    const maxB = A4.b - 2 * rand;
    const maxH = A4.h - 2 * rand - 24;
    const f = Math.min(maxB / jpg.width, maxH / jpg.height);
    seite.drawImage(jpg, { x: rand + (maxB - jpg.width * f) / 2, y: rand + (maxH - jpg.height * f), width: jpg.width * f, height: jpg.height * f });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
}

export function herunterladen(blob: Blob, dateiname: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dateiname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
