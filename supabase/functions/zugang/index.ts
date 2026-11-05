// Legt für eine Person einen Anmeldezugang an. Nur der Admin darf das.
// Danach kann sich die Person mit ihrer E-Mail-Adresse und einem Code anmelden.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const antwort = (daten: unknown, status = 200) => Response.json(daten, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = Deno.env.get('SUPABASE_URL')!;
  // Mit dem Zugang des Aufrufers prüfen, ob er Admin ist
  const aufrufer = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const { data: istAdmin } = await aufrufer.rpc('ist_admin');
  if (!istAdmin) return antwort({ fehler: 'Nur der Admin darf Zugänge anlegen.' }, 403);

  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  if (!email || !email.includes('@')) return antwort({ fehler: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 400);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), email_confirm: true });
  if (error && !/already|registered|exists/i.test(error.message)) return antwort({ fehler: 'Der Zugang konnte nicht angelegt werden.' }, 500);
  return antwort({ ok: true });
});
