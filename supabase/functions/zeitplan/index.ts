// Zeitplan: wird alle 10 Minuten vom Zeitgeber (Cloudflare Worker) aufgerufen.
// 1. Erinnert an unbestätigte Wochenpläne
// 2. Erledigt einmal am Tag: Prüftermine, Löschfristen, verwaiste Dateien
// 3. Verschickt wartende Benachrichtigungen, aber nur Montag bis Freitag in der erlaubten Zeit
//
// Secrets: ZEITPLAN_GEHEIMNIS, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_KONTAKT (z. B. mailto:meister@maler-riesa.de)
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase selbst bereit.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// Datum und Uhrzeit in Deutschland, unabhängig von der Zeitzone des Servers
function berlin(d = new Date()) {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false
    })
      .formatToParts(d)
      .map((t) => [t.type, t.value])
  );
  return {
    datum: `${teile.year}-${teile.month}-${teile.day}`,
    uhrzeit: `${teile.hour === '24' ? '00' : teile.hour}:${teile.minute}`,
    werktag: !['Sa', 'So'].includes(String(teile.weekday).replace('.', ''))
  };
}

const plusTage = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const plusMonate = (iso: string, monate: number) => {
  const [j, m, t] = iso.split('-').map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + monate, 1));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
};

async function buero(): Promise<string[]> {
  const { data } = await db.from('personen').select('id, aktiv_bis').in('rolle', ['admin', 'buero']);
  const heute = berlin().datum;
  return (data ?? []).filter((p) => !p.aktiv_bis || p.aktiv_bis >= heute).map((p) => p.id);
}

async function einreihen(personen: string[], titel: string, text: string, ziel: string) {
  if (personen.length) await db.from('benachrichtigungen').insert(personen.map((person_id) => ({ person_id, titel, text, ziel })));
}

async function planErinnerungen(pushVon: string) {
  const jetzt = Date.now();
  const heute = berlin().datum;
  const { data } = await db
    .from('bestaetigungen')
    .select('id, person_id, planfassungen!inner(veroeffentlicht_am)')
    .is('bestaetigt_am', null)
    .is('erinnert_am', null);
  for (const b of data ?? []) {
    const fassung = b.planfassungen as unknown as { veroeffentlicht_am: string };
    // Zwei Stunden ab Veröffentlichung, frühestens zwei Stunden nach Beginn der Zustellzeit heute
    const tagesbeginn = new Date(`${heute}T${pushVon}:00`).getTime() - zeitzonenVersatz(heute);
    const ab = Math.max(new Date(fassung.veroeffentlicht_am).getTime(), tagesbeginn) + 2 * 3600_000;
    if (jetzt < ab) continue;
    await einreihen([b.person_id], 'Wochenplan bestätigen', 'Bitte sieh dir den neuen Wochenplan an und bestätige ihn.', '/');
    await db.from('bestaetigungen').update({ erinnert_am: new Date().toISOString() }).eq('id', b.id);
  }
}

// Unterschied zwischen deutscher Zeit und UTC an diesem Tag in Millisekunden (Sommer- und Winterzeit)
function zeitzonenVersatz(iso: string): number {
  const mittag = new Date(`${iso}T12:00:00Z`);
  const b = berlin(mittag);
  const [h, m] = b.uhrzeit.split(':').map(Number);
  return ((h - 12) * 60 + m) * 60_000;
}

async function taeglich(heute: string) {
  const { data: lauf } = await db.from('zeitplan_laeufe').select('zuletzt').eq('art', 'taeglich').maybeSingle();
  if (lauf?.zuletzt === heute) return 'schon erledigt';

  // Prüftermine: Hinweis 30 Tage vorher und am Fälligkeitstag
  const { data: pruefungen } = await db.from('pruefungen').select('art, intervall_monate, zuletzt, maschinen(bezeichnung)');
  const faellig = (pruefungen ?? []).filter((p) => {
    if (!p.zuletzt) return false;
    const naechste = plusMonate(p.zuletzt, p.intervall_monate);
    return naechste === heute || naechste === plusTage(heute, 30);
  });
  if (faellig.length) {
    await einreihen(await buero(), 'Prüftermine', `${faellig.length} Maschinenprüfung(en) stehen an. Details in der Maschinenliste.`, '/buero/maschinen');
  }

  // Löschfristen (siehe Löschkonzept in ANLEITUNG.md)
  const vor = (tage: number) => plusTage(heute, -tage);
  const jahr = Number(heute.slice(0, 4));
  await db.from('krankmeldungen').delete().lt('ab', vor(90)).or(`bis_voraussichtlich.is.null,bis_voraussichtlich.lt.${vor(90)}`);
  await db.from('abwesenheiten').delete().eq('art', 'urlaub').lt('bis', `${jahr - 1}-01-01`);
  await db.from('abwesenheiten').delete().neq('art', 'urlaub').lt('bis', vor(730));
  await db.from('einsaetze').delete().lt('datum', vor(730));
  await db.from('stunden').delete().lt('datum', vor(730));
  await db.from('planfassungen').delete().lt('woche', vor(730));
  await db.from('meldungen').delete().eq('status', 'erledigt').lt('erledigt_am', vor(365));
  await db.from('benachrichtigungen').delete().lt('erstellt_am', vor(30));
  // Ausgeschiedene: Zugang ist ab dem Folgetag gesperrt, nach 3 Monaten wird die Person gelöscht
  const { data: weg } = await db.from('personen').select('id, email').lt('aktiv_bis', vor(90));
  for (const p of weg ?? []) {
    await db.from('personen').delete().eq('id', p.id);
    if (p.email) {
      const { data: nutzer } = await db.auth.admin.listUsers({ perPage: 1000 });
      const u = nutzer?.users.find((x) => x.email?.toLowerCase() === p.email.toLowerCase());
      if (u) await db.auth.admin.deleteUser(u.id);
    }
  }

  await dateienAufraeumen();
  await db.from('zeitplan_laeufe').upsert({ art: 'taeglich', zuletzt: heute });
  return 'erledigt';
}

// Dateien, auf die kein Datensatz mehr verweist und die älter als 2 Tage sind, löschen.
// Die 2 Tage schützen Dateien, die schon hochgeladen sind, deren Datensatz aber noch im Postausgang wartet.
async function dateienAufraeumen() {
  const benutzt = new Set<string>();
  const sammeln = async (tabelle: string, spalte: string) => {
    const { data } = await db.from(tabelle).select(spalte);
    for (const z of (data ?? []) as Record<string, unknown>[]) {
      const w = z[spalte];
      if (Array.isArray(w)) w.forEach((x) => benutzt.add(String(x)));
      else if (w) benutzt.add(String(w));
    }
  };
  await Promise.all([sammeln('fotos', 'pfad'), sammeln('dokumente', 'pfad'), sammeln('lieferscheine', 'seiten'), sammeln('meldungen', 'foto_pfad')]);
  const grenze = Date.now() - 2 * 864e5;
  const loeschen: string[] = [];
  const durchsuchen = async (ordner: string) => {
    const { data } = await db.storage.from('dateien').list(ordner, { limit: 1000 });
    for (const e of data ?? []) {
      const pfad = ordner ? `${ordner}/${e.name}` : e.name;
      if (!e.id) await durchsuchen(pfad); // Ordner
      else if (!benutzt.has(pfad) && new Date(e.created_at).getTime() < grenze) loeschen.push(pfad);
    }
  };
  await durchsuchen('');
  for (let i = 0; i < loeschen.length; i += 100) await db.storage.from('dateien').remove(loeschen.slice(i, i + 100));
}

async function zustellen() {
  const { data: offen } = await db.from('benachrichtigungen').select('*').is('gesendet_am', null).order('erstellt_am').limit(500);
  if (!offen?.length) return 0;
  // Gleiche Nachrichten an dieselbe Person zusammenfassen (z. B. drei Lieferscheine am Morgen)
  const gruppen = new Map<string, typeof offen>();
  for (const b of offen) {
    const k = `${b.person_id}|${b.titel}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), b]);
  }
  let gesendet = 0;
  for (const liste of gruppen.values()) {
    const erste = liste[0];
    const text = liste.length > 1 ? `${erste.text} (${liste.length} neue)` : erste.text;
    const { data: abos } = await db.from('push_abos').select('*').eq('person_id', erste.person_id);
    for (const abo of abos ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } },
          JSON.stringify({ titel: erste.titel, text, ziel: erste.ziel }),
          { TTL: 24 * 3600 }
        );
        gesendet++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from('push_abos').delete().eq('endpoint', abo.endpoint);
      }
    }
    await db.from('benachrichtigungen').update({ gesendet_am: new Date().toISOString() }).in('id', liste.map((b) => b.id));
  }
  return gesendet;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-zeitplan-geheimnis') !== Deno.env.get('ZEITPLAN_GEHEIMNIS')) {
    return new Response('Nicht erlaubt', { status: 401 });
  }
  webpush.setVapidDetails(Deno.env.get('VAPID_KONTAKT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
  const { data: e } = await db.from('einstellungen').select('*').eq('id', 'standard').maybeSingle();
  const pushVon: string = e?.push_von ?? '06:30';
  const pushBis: string = e?.push_bis ?? '18:00';
  const jetzt = berlin();
  const zustellzeit = jetzt.werktag && jetzt.uhrzeit >= pushVon && jetzt.uhrzeit < pushBis;
  const ergebnis: Record<string, unknown> = { jetzt, zustellzeit };
  try {
    if (zustellzeit) await planErinnerungen(pushVon);
    if (jetzt.uhrzeit >= '05:00') ergebnis.taeglich = await taeglich(jetzt.datum);
    ergebnis.gesendet = zustellzeit ? await zustellen() : 0;
  } catch (fehler) {
    ergebnis.fehler = String(fehler);
    return Response.json(ergebnis, { status: 500 });
  }
  return Response.json(ergebnis);
});
