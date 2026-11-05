// Fotos verkleinern und Lieferscheine lesbarer machen, bevor sie gespeichert werden.
// Ein Handyfoto hat 3 bis 6 MB, danach etwa 200 bis 400 KB. Das spart Datenvolumen und Speicherplatz.

async function bildLaden(datei: Blob): Promise<HTMLImageElement | ImageBitmap> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(datei, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      // ältere Browser: unten über ein img-Element
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    img.src = URL.createObjectURL(datei);
  });
}

function leinwand(bild: HTMLImageElement | ImageBitmap, maxKante: number): HTMLCanvasElement {
  const b = 'naturalWidth' in bild ? bild.naturalWidth : bild.width;
  const h = 'naturalHeight' in bild ? bild.naturalHeight : bild.height;
  const faktor = Math.min(1, maxKante / Math.max(b, h));
  const c = document.createElement('canvas');
  c.width = Math.round(b * faktor);
  c.height = Math.round(h * faktor);
  c.getContext('2d')!.drawImage(bild, 0, 0, c.width, c.height);
  return c;
}

const alsJpeg = (c: HTMLCanvasElement, qualitaet: number) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht gespeichert werden.'))), 'image/jpeg', qualitaet));

export async function fotoVerkleinern(datei: Blob, maxKante = 1600): Promise<Blob> {
  return alsJpeg(leinwand(await bildLaden(datei), maxKante), 0.8);
}

// Lieferschein: Graustufen und Kontrast strecken, damit Schrift auch bei schlechtem Licht lesbar ist.
// Die hellsten 2 % werden Weiß, die dunkelsten 2 % Schwarz, dazwischen gleichmäßig verteilt.
export async function lieferscheinAufbereiten(datei: Blob): Promise<Blob> {
  const c = leinwand(await bildLaden(datei), 2000);
  const ctx = c.getContext('2d')!;
  const bild = ctx.getImageData(0, 0, c.width, c.height);
  const px = bild.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const grau = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = grau;
    hist[grau]++;
  }
  const n = px.length / 4;
  let summe = 0;
  let unten = 0;
  let oben = 255;
  for (let g = 0; g < 256; g++) {
    summe += hist[g];
    if (summe <= n * 0.02) unten = g;
    if (summe <= n * 0.98) oben = g;
  }
  const spanne = Math.max(1, oben - unten);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - unten) / spanne) * 255));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(bild, 0, 0);
  return alsJpeg(c, 0.75);
}
