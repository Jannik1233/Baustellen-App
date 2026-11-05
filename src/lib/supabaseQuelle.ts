import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../verbindung';
import type { Datenquelle } from './datenquelle';
import type { Person, Planfassung, Tabellen, TabellenName } from './types';

// Die Datenbank verwendet snake_case, die App camelCase.
const zuSnake = (s: string) => s.replace(/[A-Z]/g, (b) => '_' + b.toLowerCase());
const zuCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, b: string) => b.toUpperCase());

function umschluesseln(obj: Record<string, unknown>, f: (s: string) => string): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) r[f(k)] = v;
  return r;
}

const BUCKET = 'dateien';

export function supabaseKonfiguriert(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // PKCE: Ein Anmeldelink aus der E-Mail kommt als ?code=... zurück und verträgt sich so mit dem HashRouter.
      auth: { flowType: 'pkce' }
    });
  return client;
}

// Anmeldung mit 6-stelligem Code per E-Mail. Funktioniert auch in der App vom Startbildschirm,
// anders als ein Link, der sich im Browser statt in der App öffnen würde.
export async function codeSenden(email: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
  if (!error) return null;
  if (/signups? not allowed|not found|user/i.test(error.message)) return 'Für diese E-Mail-Adresse gibt es keinen Zugang. Bitte im Büro melden.';
  // Originalmeldung anhängen, damit sich ein Fehler aus der Ferne erkennen lässt
  return `Der Code konnte nicht gesendet werden. Bitte in einer Minute erneut versuchen. (${error.message})`;
}

export async function codePruefen(email: string, code: string): Promise<string | null> {
  const { error } = await supabase().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  return error ? 'Der Code stimmt nicht oder ist abgelaufen.' : null;
}

export async function hatSitzung(): Promise<boolean> {
  const { data } = await supabase().auth.getSession();
  return Boolean(data.session);
}

// Legt für eine Person den Anmeldezugang an (nur Admin, prüft der Server)
export async function zugangAnlegen(email: string): Promise<string | null> {
  const { data, error } = await supabase().functions.invoke('zugang', { body: { email } });
  if (error) return 'Der Zugang konnte nicht angelegt werden.';
  return (data as { fehler?: string } | null)?.fehler ?? null;
}

export const supabaseQuelle: Datenquelle = {
  modus: 'online',

  async aktuellerBenutzer(): Promise<Person | null> {
    const { data } = await supabase().auth.getSession();
    const email = data.session?.user.email;
    if (!email) return null;
    const { data: zeile, error } = await supabase().from('personen').select('*').ilike('email', email).maybeSingle();
    if (error) throw new Error(error.message);
    return zeile ? (umschluesseln(zeile, zuCamel) as unknown as Person) : null;
  },

  async abmelden() {
    await supabase().auth.signOut();
  },

  async laden<T extends TabellenName>(tabelle: T): Promise<Tabellen[T][]> {
    const { data, error } = await supabase().from(tabelle).select('*');
    // Tabelle noch nicht angelegt (neue Funktion, Datenbank-Ergänzung fehlt noch): leer statt Absturz
    if (error && (error.code === '42P01' || error.code === 'PGRST205')) return [];
    if (error) throw new Error(error.message);
    return (data ?? []).map((z) => umschluesseln(z, zuCamel)) as unknown as Tabellen[T][];
  },

  // Erst ändern, und nur wenn es die Zeile noch nicht gibt, anlegen. Ein "upsert" würde auch beim Ändern
  // die Regel fürs Anlegen prüfen, und die erlaubt zum Beispiel dem Büro nicht, fremde Meldungen anzulegen.
  async speichern(tabelle, zeile) {
    const werte = umschluesseln(zeile as unknown as Record<string, unknown>, zuSnake);
    const geaendert = await supabase().from(tabelle).update(werte).eq('id', zeile.id).select();
    if (geaendert.error) throw new Error(geaendert.error.message);
    if (geaendert.data.length) return umschluesseln(geaendert.data[0], zuCamel) as never;
    const neu = await supabase().from(tabelle).insert(werte).select().single();
    if (neu.error) throw new Error(neu.error.message);
    return umschluesseln(neu.data, zuCamel) as never;
  },

  async loeschen(tabelle, id) {
    const { error } = await supabase().from(tabelle).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async dateiHochladen(pfad, datei) {
    const { error } = await supabase().storage.from(BUCKET).upload(pfad, datei, { upsert: true, contentType: datei.type || undefined });
    if (error) throw new Error(error.message);
  },

  async dateiLaden(pfad) {
    const { data, error } = await supabase().storage.from(BUCKET).download(pfad);
    if (error || !data) throw new Error(error?.message ?? 'Datei nicht gefunden.');
    return data;
  },

  async planVeroeffentlichen(montag, aenderung, hinweis): Promise<Planfassung> {
    const { data, error } = await supabase().rpc('plan_veroeffentlichen', {
      p_woche: montag,
      p_speichern: aenderung.speichern.map((e) => umschluesseln(e as unknown as Record<string, unknown>, zuSnake)),
      p_loeschen: aenderung.loeschen,
      p_betroffene: aenderung.betroffene,
      p_hinweis: hinweis
    });
    if (error) throw new Error(error.message);
    return umschluesseln(data as Record<string, unknown>, zuCamel) as unknown as Planfassung;
  },

  async pushAbonnieren(abo, personId) {
    const { error } = await supabase().from('push_abos').upsert({
      endpoint: abo.endpoint,
      p256dh: abo.keys?.p256dh,
      auth: abo.keys?.auth,
      person_id: personId
    });
    if (error) throw new Error(error.message);
  }
};
