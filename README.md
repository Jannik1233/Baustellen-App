# Frohes Schaffen: Baustellen-App

App für die Kommunikation zwischen Büro und Baustelle der Maler GmbH Frohes Schaffen: Wochenplan mit Lesebestätigung, Baustellenblatt, Material- und Maschinenmeldungen, Lieferscheine fotografieren, Urlaub und Krankmeldung (ohne Gesundheitsdaten), Maschinenliste mit Prüfterminen, Dokumente.

* **Ausprobieren:** `npm install`, dann `npm run dev`. Ohne Datei `.env` startet der Demo-Modus mit Beispieldaten.
* **Einrichten und online stellen:** siehe [ANLEITUNG.md](ANLEITUNG.md).
* **Datenschutztexte:** Ordner `dokumente`.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `src/seiten` | die Bildschirme für alle, `src/seiten/buero` die für das Büro |
| `src/lib/regeln.ts` | Rechenregeln: Kalender, Feiertage Sachsen, Jugendarbeitsschutz, Urlaub, Prüftermine |
| `src/lib/daten.tsx`, `postausgang.ts` | Laden, Zwischenspeichern auf dem Handy, Nachsenden ohne Netz, Rückgängig |
| `src/lib/winworker.ts` | Übernahme der Projektliste aus WinWorker (CSV) |
| `supabase/migrations` | Datenbank mit allen Rechten (wer darf was sehen und ändern) |
| `supabase/functions` | `zugang` (Anmeldung anlegen) und `zeitplan` (Benachrichtigungen, Prüftermine, Löschfristen) |
| `zeitgeber` | Cloudflare Worker, der `zeitplan` alle 10 Minuten aufruft |
| `werkzeuge` | Datenbanktest |
| `public` | Logo, App-Symbole (aus dem Firmenlogo) und Datenschutzinformation |

## Prüfen

* `npm test`: Rechenregeln, WinWorker-Import, Postausgang
* `npm run test:datenbank`: Rechte in der Datenbank mit einer echten Postgres-Datenbank im Speicher
* `npm run build`: baut die App nach `dist`
