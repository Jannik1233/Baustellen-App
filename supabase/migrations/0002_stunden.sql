-- Stundenzettel: je Person, Tag und Baustelle eine Zeile (zwei Baustellen am Tag = zwei Zeilen).
-- Im SQL Editor von Supabase einmal komplett ausführen, nach 0001_grundschema.sql.

create table stunden (
  id text primary key default gen_random_uuid()::text,
  person_id text not null references personen on delete cascade,
  datum date not null,
  baustelle_id text references baustellen on delete set null,
  beginn text not null,
  ende text not null,
  pause_min integer not null default 60 check (pause_min between 0 and 600),
  notiz text not null default '',
  status text not null default 'offen' check (status in ('offen', 'freigegeben')),
  freigegeben_am timestamptz,
  exportiert_am timestamptz,
  erstellt_am timestamptz not null default now()
);
create index stunden_person_datum on stunden (person_id, datum);

alter table stunden enable row level security;

-- Jeder sieht seine eigenen Stunden, das Büro alle. Ändern kann jeder nur, solange nicht freigegeben.
create policy stunden_lesen on stunden for select using (ist_buero() or person_id = ich());
create policy stunden_anlegen on stunden for insert with check (person_id = ich() or ist_admin());
create policy stunden_aendern on stunden for update
  using ((person_id = ich() and status = 'offen') or ist_admin())
  with check (person_id = ich() or ist_admin());
create policy stunden_loeschen on stunden for delete using ((person_id = ich() and status = 'offen') or ist_admin());

-- Freigeben und Export-Vermerk darf nur der Admin setzen
create function stunden_schuetzen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not ist_admin() then
    if tg_op = 'INSERT' then
      new.status := 'offen';
      new.freigegeben_am := null;
      new.exportiert_am := null;
    else
      new.status := old.status;
      new.freigegeben_am := old.freigegeben_am;
      new.exportiert_am := old.exportiert_am;
      new.person_id := old.person_id;
    end if;
  elsif new.status = 'freigegeben' and (tg_op = 'INSERT' or old.status <> 'freigegeben') then
    new.freigegeben_am := now();
  elsif new.status = 'offen' then
    new.freigegeben_am := null;
  end if;
  return new;
end $$;
create trigger stunden_schuetzen before insert or update on stunden for each row execute function stunden_schuetzen();

grant select, insert, update, delete on stunden to authenticated;
