-- Mitarbeiter-Index aus WinWorker, damit der Stunden-Export die richtige Person trifft (Ergänzung vom 27.10.2026)
alter table personen add column if not exists winworker_nr text not null default '';
