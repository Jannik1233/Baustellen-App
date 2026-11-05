-- Frohes Schaffen: Datenbank für die Baustellen-App
-- Einmal im SQL-Editor von Supabase ausführen (siehe ANLEITUNG.md).
-- Spaltennamen in snake_case, die App wandelt sie in camelCase um.
-- Wer was sehen und ändern darf, regelt die Datenbank selbst (Row Level Security), nicht nur die App.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table personen (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null default '',
  telefon text not null default '',
  rolle text not null default 'mitarbeiter' check (rolle in ('admin', 'buero', 'mitarbeiter')),
  im_plan boolean not null default true,
  azubi boolean not null default false,
  jugendlich_bis date, -- Tag des 18. Geburtstags, statt Geburtsdatum
  aktiv_bis date -- danach ist der Zugang gesperrt
);
create unique index personen_email on personen (lower(email)) where email <> '';

create table baustellen (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  kunde text not null default '',
  strasse text not null default '',
  plz text not null default '',
  ort text not null default '',
  zugang text not null default '',
  arbeitsbeginn text not null default '',
  leistung text not null default '',
  bewohnt boolean not null default false,
  denkmalschutz boolean not null default false,
  geruest boolean not null default false,
  notizen text not null default '',
  status text not null default 'geplant' check (status in ('geplant', 'laeuft', 'abgeschlossen')),
  abgeschlossen_am date,
  winworker_nr text not null default ''
);

create table kontakte (
  id text primary key default gen_random_uuid()::text,
  baustelle_id text not null references baustellen on delete cascade,
  name text not null,
  rolle text not null default 'Kunde',
  telefon text not null default ''
);

create table materialien (
  id text primary key default gen_random_uuid()::text,
  baustelle_id text not null references baustellen on delete cascade,
  bezeichnung text not null,
  farbton text not null default '',
  menge text not null default ''
);

create table fotos (
  id text primary key default gen_random_uuid()::text,
  baustelle_id text not null references baustellen on delete cascade,
  art text not null default 'ist' check (art in ('ist', 'fortschritt', 'mangel')),
  pfad text not null,
  notiz text not null default '',
  erstellt_von text references personen on delete set null,
  erstellt_am timestamptz not null default now()
);

create table einsaetze (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references personen on delete cascade,
  baustelle_id text not null references baustellen on delete cascade,
  datum date not null,
  beginn text not null default '06:30',
  ende text not null default '16:00',
  notiz text not null default ''
);
create index einsaetze_person_datum on einsaetze (person_id, datum);

create table planfassungen (
  id text primary key default gen_random_uuid()::text,
  woche date not null,
  veroeffentlicht_am timestamptz not null default now(),
  hinweis text not null default ''
);

create table bestaetigungen (
  id text primary key default gen_random_uuid()::text,
  planfassung_id text not null references planfassungen on delete cascade,
  person_id text not null references personen on delete cascade,
  bestaetigt_am timestamptz,
  erinnert_am timestamptz
);

create table abwesenheiten (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references personen on delete cascade,
  art text not null check (art in ('urlaub', 'abwesend', 'berufsschule', 'sonstiges')),
  von date not null,
  bis date not null,
  status text not null default 'beantragt' check (status in ('beantragt', 'genehmigt', 'abgelehnt')),
  notiz text not null default '',
  erstellt_am timestamptz not null default now(),
  check (bis >= von)
);

create table urlaubskonten (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references personen on delete cascade,
  jahr int not null,
  anspruch numeric not null default 0,
  genommen numeric not null default 0,
  stand_vom date not null default current_date,
  unique (person_id, jahr)
);

-- Nur die Tatsache der Krankmeldung. Keine Diagnose, kein Attest (es gilt die eAU).
create table krankmeldungen (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references personen on delete cascade,
  ab date not null,
  bis_voraussichtlich date,
  gemeldet_am timestamptz not null default now()
);

create table maschinen (
  id text primary key default gen_random_uuid()::text,
  bezeichnung text not null,
  inventar_nr text not null default '',
  standort_baustelle_id text references baustellen on delete set null,
  zustand text not null default 'ok' check (zustand in ('ok', 'defekt', 'reparatur')),
  notiz text not null default ''
);

create table pruefungen (
  id text primary key default gen_random_uuid()::text,
  maschine_id text not null references maschinen on delete cascade,
  art text not null,
  intervall_monate int not null default 12,
  zuletzt date
);

create table meldungen (
  id text primary key default gen_random_uuid()::text,
  art text not null check (art in ('maschine', 'material')),
  melder_id text not null references personen on delete cascade,
  baustelle_id text references baustellen on delete set null,
  maschine_id text references maschinen on delete set null,
  arbeit_steht boolean not null default false,
  material text not null default '',
  menge text not null default '',
  benoetigt_bis date,
  beschreibung text not null default '',
  foto_pfad text,
  status text not null default 'offen' check (status in ('offen', 'in_bearbeitung', 'erledigt')),
  erstellt_am timestamptz not null default now(),
  erledigt_am timestamptz
);

create table lieferscheine (
  id text primary key default gen_random_uuid()::text,
  baustelle_id text references baustellen on delete set null,
  datum date not null default current_date,
  lieferant text not null default '',
  seiten text[] not null default '{}',
  status text not null default 'offen' check (status in ('offen', 'geprueft', 'abgelegt')),
  erfasst_von text references personen on delete set null,
  erfasst_am timestamptz not null default now()
);

create table dokumente (
  id text primary key default gen_random_uuid()::text,
  baustelle_id text references baustellen on delete cascade, -- leer = allgemein
  kategorie text not null default 'sonstiges',
  titel text not null,
  pfad text not null,
  dateiname text not null default '',
  offline boolean not null default false,
  hochgeladen_am timestamptz not null default now()
);

create table einstellungen (
  id text primary key default 'standard',
  beginn text not null default '06:30',
  ende text not null default '16:00',
  ende_freitag text not null default '12:00',
  push_von text not null default '06:30',
  push_bis text not null default '18:00'
);
insert into einstellungen (id) values ('standard');

-- Empfangsadressen für Benachrichtigungen, je Gerät eine
create table push_abos (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  person_id text not null references personen on delete cascade,
  erstellt_am timestamptz not null default now()
);

-- Warteschlange der Benachrichtigungen. Der Zeitplan verschickt sie nur zu den erlaubten Zeiten.
-- Texte enthalten bewusst keine Namen oder Gründe, weil sie über Server von Apple und Google laufen.
create table benachrichtigungen (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references personen on delete cascade,
  titel text not null,
  text text not null,
  ziel text not null default '/',
  erstellt_am timestamptz not null default now(),
  gesendet_am timestamptz
);

-- Merkt sich, wann tägliche Aufgaben zuletzt liefen
create table zeitplan_laeufe (
  art text primary key,
  zuletzt date not null
);

-- ---------------------------------------------------------------------------
-- Wer bin ich? Hilfsfunktionen für die Zugriffsregeln
-- ---------------------------------------------------------------------------

-- Die angemeldete Person, erkannt an der E-Mail-Adresse des Zugangs. Gesperrte Personen gelten als niemand.
create function ich() returns text
language sql stable security definer set search_path = public as $$
  select id from personen
  where email <> '' and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and (aktiv_bis is null or aktiv_bis >= current_date)
  limit 1
$$;

create function meine_rolle() returns text
language sql stable security definer set search_path = public as $$
  select rolle from personen where id = ich()
$$;

create function ist_admin() returns boolean
language sql stable as $$ select coalesce(meine_rolle() = 'admin', false) $$;

create function ist_buero() returns boolean
language sql stable as $$ select coalesce(meine_rolle() in ('admin', 'buero'), false) $$;

-- Baustellen, auf denen ich von 14 Tagen zurück bis 28 Tage voraus eingeplant bin (gleiche Regel wie in der App)
create function sichtbare_baustellen() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct baustelle_id from einsaetze
  where person_id = ich() and datum between current_date - 14 and current_date + 28
$$;

-- Bin ich an diesem Tag auf dieser Baustelle? Dann sehe ich, wer noch dort ist.
create function mit_mir_eingeplant(p_baustelle text, p_datum date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from einsaetze where person_id = ich() and baustelle_id = p_baustelle and datum = p_datum)
$$;

-- Eine Benachrichtigung einreihen. Nie an mich selbst.
create function benachrichtigen(p_person text, p_titel text, p_text text, p_ziel text) returns void
language sql security definer set search_path = public as $$
  insert into benachrichtigungen (person_id, titel, text, ziel)
  select p_person, p_titel, p_text, p_ziel where p_person is distinct from ich()
$$;

create function buero_benachrichtigen(p_titel text, p_text text, p_ziel text) returns void
language sql security definer set search_path = public as $$
  select benachrichtigen(id, p_titel, p_text, p_ziel) from personen
  where rolle in ('admin', 'buero') and (aktiv_bis is null or aktiv_bis >= current_date)
$$;

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------

alter table personen enable row level security;
alter table baustellen enable row level security;
alter table kontakte enable row level security;
alter table materialien enable row level security;
alter table fotos enable row level security;
alter table einsaetze enable row level security;
alter table planfassungen enable row level security;
alter table bestaetigungen enable row level security;
alter table abwesenheiten enable row level security;
alter table urlaubskonten enable row level security;
alter table krankmeldungen enable row level security;
alter table maschinen enable row level security;
alter table pruefungen enable row level security;
alter table meldungen enable row level security;
alter table lieferscheine enable row level security;
alter table dokumente enable row level security;
alter table einstellungen enable row level security;
alter table push_abos enable row level security;
alter table benachrichtigungen enable row level security;
alter table zeitplan_laeufe enable row level security;

-- Team: alle sehen die Namen und Telefonnummern der Kollegen, nur der Admin pflegt sie
create policy personen_lesen on personen for select using (ich() is not null);
create policy personen_admin on personen for all using (ist_admin()) with check (ist_admin());

-- Baustellen und alles, was daran hängt: Büro alles, Mitarbeiter nur ihre eingeplanten
create policy baustellen_lesen on baustellen for select using (ist_buero() or id in (select sichtbare_baustellen()));
create policy baustellen_admin on baustellen for all using (ist_admin()) with check (ist_admin());

create policy kontakte_lesen on kontakte for select using (ist_buero() or baustelle_id in (select sichtbare_baustellen()));
create policy kontakte_admin on kontakte for all using (ist_admin()) with check (ist_admin());

create policy materialien_lesen on materialien for select using (ist_buero() or baustelle_id in (select sichtbare_baustellen()));
create policy materialien_admin on materialien for all using (ist_admin()) with check (ist_admin());

create policy fotos_lesen on fotos for select using (ist_buero() or baustelle_id in (select sichtbare_baustellen()));
create policy fotos_anlegen on fotos for insert
  with check (erstellt_von = ich() and (ist_buero() or baustelle_id in (select sichtbare_baustellen())));
create policy fotos_aendern on fotos for update using (ist_admin() or erstellt_von = ich()) with check (ist_admin() or erstellt_von = ich());
create policy fotos_loeschen on fotos for delete using (ist_admin() or erstellt_von = ich());

create policy dokumente_lesen on dokumente for select
  using (ich() is not null and (baustelle_id is null or ist_buero() or baustelle_id in (select sichtbare_baustellen())));
create policy dokumente_admin on dokumente for all using (ist_admin()) with check (ist_admin());

-- Plan: eigene Einsätze und wer am selben Tag auf derselben Baustelle ist. Ändern nur über den Admin.
create policy einsaetze_lesen on einsaetze for select
  using (ist_buero() or person_id = ich() or mit_mir_eingeplant(baustelle_id, datum));
create policy einsaetze_admin on einsaetze for all using (ist_admin()) with check (ist_admin());

create policy planfassungen_lesen on planfassungen for select using (ich() is not null);
create policy planfassungen_admin on planfassungen for all using (ist_admin()) with check (ist_admin());

create policy bestaetigungen_lesen on bestaetigungen for select using (ist_buero() or person_id = ich());
create policy bestaetigungen_eigene on bestaetigungen for update using (person_id = ich() or ist_admin()) with check (person_id = ich() or ist_admin());
create policy bestaetigungen_admin on bestaetigungen for insert with check (ist_admin());
create policy bestaetigungen_loeschen on bestaetigungen for delete using (ist_admin());

-- Abwesenheiten: Mitarbeiter beantragen nur Urlaub für sich, genehmigen darf nur der Admin
create policy abwesenheiten_lesen on abwesenheiten for select using (ist_buero() or person_id = ich());
create policy abwesenheiten_beantragen on abwesenheiten for insert
  with check (ist_admin() or (person_id = ich() and art = 'urlaub' and status = 'beantragt'));
create policy abwesenheiten_aendern on abwesenheiten for update using (ist_admin()) with check (ist_admin());
create policy abwesenheiten_zurueckziehen on abwesenheiten for delete
  using (ist_admin() or (person_id = ich() and status = 'beantragt'));

create policy urlaubskonten_lesen on urlaubskonten for select using (ist_buero() or person_id = ich());
create policy urlaubskonten_admin on urlaubskonten for all using (ist_admin()) with check (ist_admin());

create policy krank_lesen on krankmeldungen for select using (ist_buero() or person_id = ich());
create policy krank_melden on krankmeldungen for insert with check (person_id = ich() or ist_admin());
create policy krank_admin on krankmeldungen for update using (ist_admin()) with check (ist_admin());
create policy krank_loeschen on krankmeldungen for delete using (ist_admin());

create policy maschinen_lesen on maschinen for select using (ich() is not null);
create policy maschinen_buero on maschinen for update using (ist_buero()) with check (ist_buero());
create policy maschinen_admin on maschinen for all using (ist_admin()) with check (ist_admin());

create policy pruefungen_lesen on pruefungen for select using (ich() is not null);
create policy pruefungen_admin on pruefungen for all using (ist_admin()) with check (ist_admin());

-- Meldungen: jeder meldet für sich und sieht den Status, das Büro bearbeitet
create policy meldungen_lesen on meldungen for select using (ist_buero() or melder_id = ich());
create policy meldungen_anlegen on meldungen for insert with check (melder_id = ich());
create policy meldungen_aendern on meldungen for update using (ist_buero() or melder_id = ich()) with check (ist_buero() or melder_id = ich());
create policy meldungen_loeschen on meldungen for delete using (ist_admin());

create policy lieferscheine_lesen on lieferscheine for select using (ist_buero() or erfasst_von = ich());
create policy lieferscheine_anlegen on lieferscheine for insert with check (erfasst_von = ich());
create policy lieferscheine_aendern on lieferscheine for update
  using (ist_buero() or (erfasst_von = ich() and status = 'offen')) with check (ist_buero() or erfasst_von = ich());
create policy lieferscheine_loeschen on lieferscheine for delete using (ist_buero());

create policy einstellungen_lesen on einstellungen for select using (ich() is not null);
create policy einstellungen_admin on einstellungen for all using (ist_admin()) with check (ist_admin());

create policy push_eigene on push_abos for all using (person_id = ich()) with check (person_id = ich());
create policy benachrichtigungen_eigene on benachrichtigungen for select using (person_id = ich());
-- zeitplan_laeufe: kein Zugriff aus der App, nur der Zeitplan mit Dienstschlüssel

-- ---------------------------------------------------------------------------
-- Schutz einzelner Spalten: Mitarbeiter dürfen nur ergänzen, nicht den Status setzen
-- ---------------------------------------------------------------------------

create function meldung_schuetzen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not ist_buero() then
    new.status := old.status;
    new.erledigt_am := old.erledigt_am;
    new.melder_id := old.melder_id;
  elsif new.status = 'erledigt' and old.status <> 'erledigt' then
    new.erledigt_am := now();
  elsif new.status <> 'erledigt' then
    new.erledigt_am := null;
  end if;
  return new;
end $$;
create trigger meldung_schuetzen before update on meldungen for each row execute function meldung_schuetzen();

create function bestaetigung_schuetzen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not ist_admin() then
    new.planfassung_id := old.planfassung_id;
    new.person_id := old.person_id;
    new.erinnert_am := old.erinnert_am;
  end if;
  return new;
end $$;
create trigger bestaetigung_schuetzen before update on bestaetigungen for each row execute function bestaetigung_schuetzen();

create function lieferschein_schuetzen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not ist_buero() then
    new.status := old.status;
    new.erfasst_von := old.erfasst_von;
  end if;
  return new;
end $$;
create trigger lieferschein_schuetzen before update on lieferscheine for each row execute function lieferschein_schuetzen();

-- ---------------------------------------------------------------------------
-- Automatische Folgen und Benachrichtigungen
-- ---------------------------------------------------------------------------

-- Krankmeldung: im Plan steht nur "abwesend", ohne Grund. Das Büro bekommt Bescheid.
create function krankmeldung_folgen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into abwesenheiten (id, person_id, art, von, bis, status, erstellt_am)
  values ('krank-' || new.id, new.person_id, 'abwesend', new.ab, coalesce(new.bis_voraussichtlich, new.ab), 'genehmigt', new.gemeldet_am)
  on conflict (id) do update set von = excluded.von, bis = excluded.bis;
  if tg_op = 'INSERT' then
    perform buero_benachrichtigen('Neue Abwesenheit', 'Es ist eine Krankmeldung eingegangen.', '/buero/abwesenheiten');
  end if;
  return new;
end $$;
create trigger krankmeldung_folgen after insert or update on krankmeldungen for each row execute function krankmeldung_folgen();

create function meldung_benachrichtigen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform buero_benachrichtigen(
      case when new.art = 'maschine' and new.arbeit_steht then 'Maschine kaputt: Arbeit steht'
           when new.art = 'maschine' then 'Maschine kaputt'
           else 'Material fehlt' end,
      'Neue Meldung von der Baustelle.', '/buero/meldungen');
  elsif new.status is distinct from old.status then
    perform benachrichtigen(new.melder_id, 'Deine Meldung',
      case new.status when 'erledigt' then 'Deine Meldung ist erledigt.'
                      when 'in_bearbeitung' then 'Deine Meldung ist in Bearbeitung.'
                      else 'Deine Meldung ist wieder offen.' end,
      '/meldungen');
  end if;
  return new;
end $$;
create trigger meldung_benachrichtigen after insert or update on meldungen for each row execute function meldung_benachrichtigen();

create function abwesenheit_benachrichtigen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.art = 'urlaub' and new.status = 'beantragt' then
    perform buero_benachrichtigen('Neuer Urlaubsantrag', 'Ein Urlaubsantrag wartet auf Genehmigung.', '/buero/abwesenheiten');
  elsif tg_op = 'UPDATE' and new.art = 'urlaub' and new.status is distinct from old.status and new.status <> 'beantragt' then
    perform benachrichtigen(new.person_id, 'Urlaubsantrag',
      case new.status when 'genehmigt' then 'Dein Urlaub wurde genehmigt.' else 'Dein Urlaubsantrag wurde abgelehnt.' end,
      '/urlaub');
  end if;
  return new;
end $$;
create trigger abwesenheit_benachrichtigen after insert or update on abwesenheiten for each row execute function abwesenheit_benachrichtigen();

create function lieferschein_benachrichtigen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform buero_benachrichtigen('Neuer Lieferschein', 'Ein Lieferschein wurde erfasst.', '/buero/lieferscheine');
  return new;
end $$;
create trigger lieferschein_benachrichtigen after insert on lieferscheine for each row execute function lieferschein_benachrichtigen();

-- Plan veröffentlichen: Änderungen einer Woche in einem Schritt übernehmen, Bestätigungen anlegen,
-- Betroffene benachrichtigen. Wer selbst veröffentlicht, gilt als bestätigt.
create function plan_veroeffentlichen(p_woche date, p_speichern jsonb, p_loeschen text[], p_betroffene text[], p_hinweis text default '')
returns planfassungen
language plpgsql security definer set search_path = public as $$
declare
  f planfassungen;
  e jsonb;
  p text;
begin
  if not ist_admin() then
    raise exception 'Nur der Admin darf den Plan veröffentlichen.';
  end if;
  delete from einsaetze where id = any(coalesce(p_loeschen, '{}'));
  for e in select * from jsonb_array_elements(coalesce(p_speichern, '[]'::jsonb)) loop
    insert into einsaetze (id, person_id, baustelle_id, datum, beginn, ende, notiz)
    values (e ->> 'id', e ->> 'person_id', e ->> 'baustelle_id', (e ->> 'datum')::date,
            coalesce(e ->> 'beginn', '06:30'), coalesce(e ->> 'ende', '16:00'), coalesce(e ->> 'notiz', ''))
    on conflict (id) do update set person_id = excluded.person_id, baustelle_id = excluded.baustelle_id,
      datum = excluded.datum, beginn = excluded.beginn, ende = excluded.ende, notiz = excluded.notiz;
  end loop;
  insert into planfassungen (woche, hinweis) values (p_woche, coalesce(p_hinweis, '')) returning * into f;
  foreach p in array coalesce(p_betroffene, '{}') loop
    insert into bestaetigungen (planfassung_id, person_id, bestaetigt_am)
    values (f.id, p, case when p = ich() then now() end);
    perform benachrichtigen(p, 'Neuer Wochenplan',
      'Der Plan für KW ' || extract(week from p_woche)::int || ' wurde geändert. Bitte ansehen und bestätigen.', '/');
  end loop;
  return f;
end $$;

-- ---------------------------------------------------------------------------
-- Dateien (Fotos, Lieferscheine, Dokumente) im privaten Speicherbereich "dateien"
-- Pfade: baustelle/<id>/..., dokument/<id>/..., lieferschein/<id>/..., meldung/<id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('dateien', 'dateien', false) on conflict (id) do nothing;

create policy dateien_lesen on storage.objects for select to authenticated using (
  bucket_id = 'dateien' and ich() is not null and (
    ist_buero()
    or owner = auth.uid()
    or (storage.foldername(name))[1] = 'dokument'
    or ((storage.foldername(name))[1] = 'baustelle' and (storage.foldername(name))[2] in (select sichtbare_baustellen()))
  )
);
create policy dateien_hochladen on storage.objects for insert to authenticated with check (bucket_id = 'dateien' and ich() is not null);
create policy dateien_ersetzen on storage.objects for update to authenticated using (bucket_id = 'dateien' and (ist_buero() or owner = auth.uid()));
create policy dateien_loeschen on storage.objects for delete to authenticated using (bucket_id = 'dateien' and ist_buero());

-- Zugriffsrechte ausdrücklich vergeben, damit es auch ohne "Automatically expose new tables" funktioniert.
-- Was jeder sehen und ändern darf, regeln weiterhin die Policies oben.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
