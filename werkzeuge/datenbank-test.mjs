// Prüft das Datenbankschema und die Zugriffsregeln, ohne Supabase-Konto.
// Läuft mit PGlite (Postgres im Browser-Format) und bildet die Teile von Supabase nach,
// auf die sich das Schema stützt (auth.jwt, auth.uid, storage).
// Aufruf: npm run test:datenbank

import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();

await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt() ->> 'sub')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema auth, storage to authenticated;
  grant all on all tables in schema storage to authenticated;
`);

await db.exec(readFileSync(new URL('../supabase/migrations/0001_grundschema.sql', import.meta.url), 'utf8'));
await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;`);

// Testdaten als Superuser
await db.exec(`
  insert into personen (id, name, email, rolle, im_plan, azubi, jugendlich_bis, aktiv_bis) values
    ('jannik', 'Jannik', 'jannik@test.de', 'admin', true, false, null, null),
    ('martina', 'Martina', 'martina@test.de', 'buero', false, false, null, null),
    ('paula', 'Paula', 'paula@test.de', 'mitarbeiter', true, false, null, null),
    ('mia', 'Mia', 'mia@test.de', 'mitarbeiter', true, true, '2028-01-01', null),
    ('weg', 'Ehemalig', 'weg@test.de', 'mitarbeiter', true, false, null, current_date - 1);
  insert into baustellen (id, name) values ('b1', 'Fassade'), ('b2', 'Treppenhaus'), ('b3', 'Alt');
  insert into einsaetze (id, person_id, baustelle_id, datum) values
    ('e1', 'paula', 'b1', current_date), ('e2', 'mia', 'b1', current_date),
    ('e3', 'mia', 'b2', current_date + 1), ('e4', 'paula', 'b3', current_date - 40), ('e5', 'weg', 'b1', current_date);
  insert into kontakte (baustelle_id, name) values ('b1', 'Kunde 1'), ('b2', 'Kunde 2');
`);

const UUID = {
  jannik: '00000000-0000-0000-0000-000000000001', martina: '00000000-0000-0000-0000-000000000002',
  paula: '00000000-0000-0000-0000-000000000003', mia: '00000000-0000-0000-0000-000000000004', weg: '00000000-0000-0000-0000-000000000005'
};

async function als(person, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ email: `${person}@test.de`, sub: UUID[person] })}', false); set role authenticated;`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

async function scheitert(person, sql, params) {
  try {
    await als(person, sql, params);
  } catch {
    return true;
  }
  return false;
}

const ids = (rows) => rows.map((r) => r.id).sort();
let n = 0;
const pruefe = async (name, f) => {
  await f();
  n++;
  console.log(`  ok  ${name}`);
};

console.log('Zugriffsregeln');

await pruefe('Paula sieht nur die Baustelle, auf der sie zeitnah eingeplant ist', async () => {
  assert.deepEqual(ids(await als('paula', 'select id from baustellen')), ['b1']);
  assert.deepEqual((await als('paula', 'select name from kontakte')).map((r) => r.name), ['Kunde 1']);
});

await pruefe('Paula sieht ihre Einsätze und wer am selben Tag mit ihr dort ist, aber nicht Mias andere Baustelle', async () => {
  assert.deepEqual(ids(await als('paula', 'select id from einsaetze')), ['e1', 'e2', 'e4', 'e5']);
});

await pruefe('Das Büro sieht alle Baustellen', async () => {
  assert.deepEqual(ids(await als('martina', 'select id from baustellen')), ['b1', 'b2', 'b3']);
});

await pruefe('Gesperrte Zugänge sehen nichts', async () => {
  assert.deepEqual(await als('weg', 'select id from baustellen'), []);
  assert.deepEqual(await als('weg', 'select id from personen'), []);
});

await pruefe('Mitarbeiter können den Plan nicht ändern und nicht veröffentlichen', async () => {
  assert.equal(await scheitert('paula', "insert into einsaetze (person_id, baustelle_id, datum) values ('paula', 'b2', current_date)"), true);
  assert.equal(await scheitert('paula', "select plan_veroeffentlichen(current_date, '[]'::jsonb, '{}', '{}', '')"), true);
  assert.equal(await scheitert('martina', "select plan_veroeffentlichen(current_date, '[]'::jsonb, '{}', '{}', '')"), true);
});

await pruefe('Krankmeldung erzeugt eine Abwesenheit ohne Grund und benachrichtigt das Büro, nicht die Kollegin', async () => {
  await als('paula', "insert into krankmeldungen (id, person_id, ab, bis_voraussichtlich) values ('k1', 'paula', current_date, current_date + 2)");
  const abw = await db.query("select art, status from abwesenheiten where person_id = 'paula'");
  assert.deepEqual(abw.rows, [{ art: 'abwesend', status: 'genehmigt' }]);
  const b = await db.query("select person_id from benachrichtigungen where titel = 'Neue Abwesenheit' order by person_id");
  assert.deepEqual(b.rows.map((r) => r.person_id), ['jannik', 'martina']);
  assert.deepEqual(await als('mia', 'select id from krankmeldungen'), []);
  assert.equal((await als('martina', 'select id from krankmeldungen')).length, 1);
});

await pruefe('Mitarbeiter können Urlaub nur beantragen, nicht selbst genehmigen', async () => {
  assert.equal(
    await scheitert('paula', "insert into abwesenheiten (person_id, art, von, bis, status) values ('paula', 'urlaub', current_date + 30, current_date + 34, 'genehmigt')"),
    true
  );
  await als('paula', "insert into abwesenheiten (id, person_id, art, von, bis, status) values ('u1', 'paula', 'urlaub', current_date + 30, current_date + 34, 'beantragt')");
  assert.equal(await scheitert('paula', "insert into abwesenheiten (person_id, art, von, bis, status) values ('mia', 'urlaub', current_date + 30, current_date + 34, 'beantragt')"), true);
  await als('paula', "update abwesenheiten set status = 'genehmigt' where id = 'u1'");
  assert.equal((await db.query("select status from abwesenheiten where id = 'u1'")).rows[0].status, 'beantragt');
  await als('jannik', "update abwesenheiten set status = 'genehmigt' where id = 'u1'");
  const b = await db.query("select text from benachrichtigungen where person_id = 'paula' and titel = 'Urlaubsantrag'");
  assert.equal(b.rows[0].text, 'Dein Urlaub wurde genehmigt.');
});

await pruefe('Meldung: Melder kann den Status nicht setzen, das Büro schon, und der Melder erfährt es', async () => {
  await als('paula', "insert into meldungen (id, art, melder_id, baustelle_id, material) values ('m1', 'material', 'paula', 'b1', 'Farbe')");
  await als('paula', "update meldungen set status = 'erledigt', beschreibung = 'dringend' where id = 'm1'");
  let r = (await db.query("select status, beschreibung from meldungen where id = 'm1'")).rows[0];
  assert.deepEqual(r, { status: 'offen', beschreibung: 'dringend' });
  await als('martina', "update meldungen set status = 'erledigt' where id = 'm1'");
  r = (await db.query("select status, erledigt_am is not null as erledigt from meldungen where id = 'm1'")).rows[0];
  assert.deepEqual(r, { status: 'erledigt', erledigt: true });
  const b = await db.query("select text from benachrichtigungen where person_id = 'paula' and titel = 'Deine Meldung'");
  assert.equal(b.rows[0].text, 'Deine Meldung ist erledigt.');
  assert.equal(await scheitert('paula', "insert into meldungen (art, melder_id) values ('material', 'mia')"), true);
  assert.deepEqual(await als('mia', 'select id from meldungen'), []);
});

await pruefe('Plan veröffentlichen: Einsätze übernehmen, Bestätigungen anlegen, eigene gilt als bestätigt', async () => {
  const speichern = JSON.stringify([
    { id: 'e9', person_id: 'paula', baustelle_id: 'b2', datum: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), beginn: '06:30', ende: '16:00', notiz: '' },
    { id: 'e10', person_id: 'jannik', baustelle_id: 'b2', datum: '2026-11-02', beginn: '06:30', ende: '16:00', notiz: '' }
  ]);
  const [f] = await als('jannik', 'select * from plan_veroeffentlichen($1::date, $2::jsonb, $3::text[], $4::text[], $5)', [
    '2026-11-02', speichern, ['e3'], ['jannik', 'mia', 'paula'], 'Treppenhaus vorgezogen'
  ]);
  assert.equal(f.hinweis, 'Treppenhaus vorgezogen');
  const e = await db.query("select id from einsaetze where id in ('e3', 'e9', 'e10') order by id");
  assert.deepEqual(e.rows.map((r) => r.id), ['e10', 'e9']);
  const b = await db.query('select person_id, bestaetigt_am is not null as bestaetigt from bestaetigungen order by person_id');
  assert.deepEqual(b.rows, [
    { person_id: 'jannik', bestaetigt: true }, { person_id: 'mia', bestaetigt: false }, { person_id: 'paula', bestaetigt: false }
  ]);
  const n = await db.query("select person_id from benachrichtigungen where titel = 'Neuer Wochenplan' order by person_id");
  assert.deepEqual(n.rows.map((r) => r.person_id), ['mia', 'paula']);
});

await pruefe('Bestätigen: nur die eigene, und nur der Zeitpunkt', async () => {
  await als('paula', "update bestaetigungen set bestaetigt_am = now(), person_id = 'mia' where person_id = 'paula'");
  const b = await db.query("select person_id, bestaetigt_am is not null as bestaetigt from bestaetigungen where person_id in ('paula', 'mia') order by person_id");
  assert.deepEqual(b.rows, [{ person_id: 'mia', bestaetigt: false }, { person_id: 'paula', bestaetigt: true }]);
});

await pruefe('Lieferschein: Mitarbeiter erfasst, sieht nur eigene, Status setzt das Büro', async () => {
  await als('mia', "insert into lieferscheine (id, baustelle_id, seiten, erfasst_von) values ('l1', 'b1', '{lieferschein/l1/1.jpg}', 'mia')");
  assert.deepEqual(await als('paula', 'select id from lieferscheine'), []);
  await als('mia', "update lieferscheine set status = 'abgelegt', lieferant = 'Händler' where id = 'l1'");
  assert.deepEqual((await db.query("select status, lieferant from lieferscheine where id = 'l1'")).rows[0], { status: 'offen', lieferant: 'Händler' });
  await als('martina', "update lieferscheine set status = 'geprueft' where id = 'l1'");
  assert.equal((await db.query("select status from lieferscheine where id = 'l1'")).rows[0].status, 'geprueft');
});

await pruefe('Dateien: eigene Uploads und Dateien sichtbarer Baustellen, sonst nichts', async () => {
  await als('mia', "insert into storage.objects (bucket_id, name) values ('dateien', 'lieferschein/l1/1.jpg')");
  await db.exec("insert into storage.objects (bucket_id, name) values ('dateien', 'baustelle/b1/foto/a.jpg'), ('dateien', 'baustelle/b2/foto/b.jpg'), ('dateien', 'dokument/d1/regeln.pdf')");
  const sicht = async (p) => (await als(p, "select name from storage.objects where bucket_id = 'dateien' order by name")).map((r) => r.name);
  // b2 ist seit der Planveröffentlichung oben für Paula sichtbar, der Lieferschein von Mia nicht
  assert.deepEqual(await sicht('paula'), ['baustelle/b1/foto/a.jpg', 'baustelle/b2/foto/b.jpg', 'dokument/d1/regeln.pdf']);
  assert.deepEqual(await sicht('mia'), ['baustelle/b1/foto/a.jpg', 'baustelle/b2/foto/b.jpg', 'dokument/d1/regeln.pdf', 'lieferschein/l1/1.jpg']);
  assert.equal((await sicht('martina')).length, 4);
  assert.deepEqual(await sicht('weg'), []);
});

await pruefe('Benachrichtigungen sieht jeder nur für sich, niemand bekommt eigene', async () => {
  const eigene = await als('paula', 'select distinct person_id from benachrichtigungen');
  assert.deepEqual(eigene.map((r) => r.person_id), ['paula']);
  const selbst = await db.query("select count(*)::int as n from benachrichtigungen where person_id = 'martina' and titel = 'Deine Meldung'");
  assert.equal(selbst.rows[0].n, 0);
});

console.log(`\n${n} Prüfungen bestanden.`);
