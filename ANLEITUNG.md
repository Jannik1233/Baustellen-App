# Frohes Schaffen: Einrichtung Schritt für Schritt

Diese Anleitung bringt die App vom eigenen Rechner in den Echtbetrieb. Sie ist für Jannik geschrieben und setzt keine Programmierkenntnisse voraus. Wer eine Stelle nicht versteht, kopiert sie einfach in Claude und fragt nach.

Zeitbedarf: etwa zwei bis drei Stunden am Stück, plus Wartezeit auf den IT-Dienstleister für die Domain.

Laufende Kosten: 0 Euro im Monat, solange die kostenlosen Grenzen reichen (siehe Abschnitt 11).

## 0. Was es gibt und wie es zusammenhängt

Die App besteht aus vier Teilen:

1. **Die App selbst** (Ordner `src`). Sie läuft im Browser und lässt sich auf dem Handy wie eine normale App auf den Startbildschirm legen. Sie liegt kostenlos bei **Cloudflare Pages**.
2. **Die Datenbank** bei **Supabase** in Frankfurt. Dort liegen alle Daten, Fotos und Dokumente. Die Datenbank prüft selbst, wer was sehen darf.
3. **Zwei kleine Server-Programme** bei Supabase (Ordner `supabase/functions`). `zugang` legt Anmeldungen an, `zeitplan` verschickt Benachrichtigungen, erinnert an Prüftermine und löscht alte Daten.
4. **Der Zeitgeber** bei Cloudflare (Ordner `zeitgeber`). Er ruft alle 10 Minuten `zeitplan` auf. Das hält nebenbei die kostenlose Datenbank wach, die sonst nach 7 Tagen ohne Nutzung pausiert.

Ohne Einrichtung startet die App im **Demo-Modus** mit Beispieldaten, die nur im eigenen Browser liegen. So lässt sich alles gefahrlos ausprobieren.

## 1. Ausprobieren auf dem eigenen Rechner

Voraussetzung ist Node.js, das für die EBT-App schon installiert ist.

1. Eine Eingabeaufforderung (Windows: `cmd`) im Ordner `Gehirn/Baustellen-App` öffnen.
2. `npm install` eingeben und warten (einige Minuten beim ersten Mal). Meldet Windows PowerShell „Ausführung von Skripts deaktiviert“, stattdessen `npm.cmd install` und später `npm.cmd run dev` eingeben, oder zuerst `cmd` tippen.
3. `npm run dev` eingeben. Es erscheint eine Adresse wie `http://localhost:5173`. Diese im Browser öffnen.
4. Eine Person wählen und herumklicken. Unter **Mehr** lässt sich die Person wechseln und alles auf die Beispieldaten zurücksetzen.

Zum Prüfen, ob alles in Ordnung ist: `npm test` (Rechenregeln) und `npm run test:datenbank` (Rechte in der Datenbank). Beide müssen „bestanden“ melden.

## 2. Supabase einrichten (Datenbank)

1. Auf https://supabase.com mit der Firmen-E-Mail ein Konto anlegen.
2. **New project** wählen. Name: `frohes-schaffen`. **Region: Central EU (Frankfurt)**. Das Datenbank-Passwort in den Passwortmanager legen. Tarif: Free.
3. Links **SQL Editor** öffnen, **New query**, den kompletten Inhalt der Datei `supabase/migrations/0001_grundschema.sql` hineinkopieren und **Run** drücken. Es muss „Success“ erscheinen.
4. Links **Project Settings**, dann **API** (oder **Data API**). Dort stehen die **Project URL** und der **anon public** Schlüssel. Beides gleich in Schritt 4 eintragen. Den **service_role** Schlüssel niemals in die App oder in eine Datei kopieren.

### Anmeldung einstellen

Die Anmeldung läuft über einen 6-stelligen Code per E-Mail. Ein Link würde auf dem iPhone im Browser statt in der App aufgehen.

1. **Authentication**, dann **Sign In / Providers** (je nach Version **Providers**, dann **Email**):
   * **Allow new users to sign up** ausschalten. Nur das Büro legt Zugänge an.
   * **Email OTP Length** auf 6 stellen, **Email OTP Expiration** auf 600 Sekunden.
2. **Authentication**, dann **Email Templates**, Vorlage **Magic Link**. Betreff: `Dein Anmeldecode für Frohes Schaffen`. Inhalt ersetzen durch:

   ```html
   <p>Hallo,</p>
   <p>dein Anmeldecode für die App Frohes Schaffen lautet:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Der Code gilt 10 Minuten. Wenn du dich nicht anmelden wolltest, kannst du diese E-Mail löschen.</p>
   ```

   Wichtig ist `{{ .Token }}`. Ohne diesen Platzhalter kommt kein Code an.
3. **Eigener E-Mail-Versand (SMTP)**: Supabase verschickt ohne eigene Einstellung nur an die Mitglieder des Supabase-Teams und nur wenige Mails pro Stunde. Deshalb unter **Authentication**, dann **Emails** (oder **Project Settings**, **Auth**, **SMTP Settings**) **Enable custom SMTP** einschalten und die Zugangsdaten eines Postfachs von maler-riesa.de eintragen, zum Beispiel `app@maler-riesa.de`. Server, Port, Benutzer und Passwort nennt der IT-Dienstleister. Absendername: `Frohes Schaffen`.
4. **Authentication**, dann **URL Configuration**: **Site URL** auf `https://app.maler-riesa.de` setzen (vorerst geht auch die Adresse aus Schritt 5).

### Den ersten Zugang anlegen (Jannik als Chef)

1. Im **SQL Editor** ausführen (Name anpassen):

   ```sql
   insert into personen (name, email, rolle, im_plan)
   values ('Jannik Nachname', 'meister@maler-riesa.de', 'admin', true);
   ```
2. **Authentication**, dann **Users**, **Add user**, **Create new user**: E-Mail `meister@maler-riesa.de`, ein beliebiges langes Passwort (wird nie gebraucht), Haken bei **Auto Confirm User**.

Alle anderen legt Jannik danach in der App unter **Personen** an und drückt dort **Anmeldung freischalten**.

## 3. Benachrichtigungs-Schlüssel erzeugen

Benachrichtigungen aufs Handy brauchen ein Schlüsselpaar. Einmal in der Eingabeaufforderung:

```
npx web-push generate-vapid-keys
```

Es erscheinen ein **Public Key** und ein **Private Key**. Beide in den Passwortmanager legen. Der Public Key kommt in Schritt 4 in die App, beide kommen in Schritt 6 zu Supabase.

## 4. Die App mit Supabase verbinden

Im Ordner `Baustellen-App` die Datei `.env.beispiel` kopieren und die Kopie `.env` nennen. Darin die drei Werte eintragen:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_VAPID_PUBLIC_KEY=B...
```

Danach `npm run dev` neu starten. Statt der Personenauswahl erscheint jetzt die Anmeldung mit E-Mail und Code. Mit `meister@maler-riesa.de` anmelden.

Die Datei `.env` enthält keine geheimen Schlüssel (der anon-Schlüssel ist öffentlich und durch die Rechte in der Datenbank abgesichert), sie gehört trotzdem nicht in fremde Hände.

## 5. Die App ins Netz stellen (Cloudflare Pages)

1. Auf https://dash.cloudflare.com ein kostenloses Konto anlegen (falls noch nicht für die EBT-App geschehen, dann dasselbe Konto nehmen).
2. In der Eingabeaufforderung im Ordner `Baustellen-App`: `npx wrangler login` und im Browser bestätigen.
3. `npm run deploy` eingeben. Beim ersten Mal fragt wrangler, ob ein Projekt `frohes-schaffen` angelegt werden soll: mit Ja bestätigen. Am Ende steht eine Adresse wie `https://frohes-schaffen.pages.dev`.

Jede spätere Änderung an der App geht mit demselben Befehl `npm run deploy` online. Die Handys holen sich die neue Version beim nächsten Öffnen von selbst.

### Eigene Adresse app.maler-riesa.de

1. In Cloudflare: **Workers & Pages**, Projekt `frohes-schaffen`, **Custom domains**, **Set up a custom domain**, `app.maler-riesa.de` eintragen.
2. Dem IT-Dienstleister diesen Text schicken:

   > Bitte für maler-riesa.de einen DNS-Eintrag anlegen: Typ CNAME, Name `app`, Ziel `frohes-schaffen.pages.dev`. Die übrigen Einträge (Website, E-Mail) bleiben unverändert. Danke!
3. Nach einigen Minuten bis Stunden zeigt Cloudflare die Domain als aktiv an.

## 6. Die Server-Programme bei Supabase anlegen

Beide Programme lassen sich im Browser anlegen, ohne Zusatzprogramm.

### zugang

1. Supabase, links **Edge Functions**, **Deploy a new function**, **Via Editor**.
2. Name: `zugang`. Den Inhalt von `supabase/functions/zugang/index.ts` hineinkopieren. **Deploy**.
3. In den Einstellungen der Funktion muss **Verify JWT** (oder **Enforce JWT verification**) eingeschaltet bleiben.

### zeitplan

1. Ebenso eine Funktion `zeitplan` anlegen mit dem Inhalt von `supabase/functions/zeitplan/index.ts`.
2. In den Einstellungen dieser Funktion **Verify JWT ausschalten**. Sie wird stattdessen über ein eigenes Geheimwort geschützt.
3. Links **Edge Functions**, dann **Secrets** (oder **Project Settings**, **Edge Functions**), diese vier Werte anlegen:

   | Name | Wert |
   | --- | --- |
   | `ZEITPLAN_GEHEIMNIS` | ein langes zufälliges Wort, zum Beispiel aus dem Passwortmanager (40 Zeichen) |
   | `VAPID_PUBLIC_KEY` | Public Key aus Schritt 3 |
   | `VAPID_PRIVATE_KEY` | Private Key aus Schritt 3 |
   | `VAPID_KONTAKT` | `mailto:meister@maler-riesa.de` |

   `SUPABASE_URL` und die Schlüssel stellt Supabase selbst bereit.

## 7. Den Zeitgeber einrichten (Cloudflare Worker)

In der Eingabeaufforderung:

```
cd zeitgeber
npx wrangler deploy
npx wrangler secret put ZEITPLAN_URL
npx wrangler secret put ZEITPLAN_GEHEIMNIS
```

Bei `ZEITPLAN_URL` die Adresse `https://xxxxxxxx.supabase.co/functions/v1/zeitplan` eingeben (xxxxxxxx wie in Schritt 4), bei `ZEITPLAN_GEHEIMNIS` dasselbe Wort wie in Schritt 6.

Prüfen: In Cloudflare unter **Workers & Pages**, `frohes-schaffen-zeitgeber`, **Logs** sollte alle 10 Minuten ein Aufruf mit Status 200 erscheinen.

## 8. Erste Daten eintragen

In dieser Reihenfolge, alles in der App am PC:

1. **Einstellungen**: Arbeitszeit 6:30 bis 16:00, Freitag bis 12:00, Benachrichtigungen 6:30 bis 18:00. Ist schon so voreingestellt.
2. **Personen**: Martina (Rolle Büro, nicht im Plan), Paula, Mia (Azubi, Tag des 18. Geburtstags eintragen, das genaue Datum fehlt noch). Jeweils **Anmeldung freischalten**.
3. **Urlaub und Abwesenheit**: Mias Berufsschulblöcke eintragen (Art Berufsschule): 09.11. bis 20.11.2026, 04.01. bis 15.01.2027, 15.03. bis 26.03.2027, 03.05. bis 06.05.2027, 10.05. bis 17.05.2027, 19.05. bis 21.05.2027, 21.06. bis 09.07.2027. Darunter die Urlaubskonten aus WinWorker übertragen.
4. **Baustellen**, **Aus WinWorker**: die Projektliste als CSV einlesen (in WinWorker als CSV oder Excel exportieren, Excel in Excel als CSV speichern). Danach je Baustelle Zugang, Ansprechpartner und Farbtöne ergänzen.
5. **Maschinen verwalten**: Maschinen mit Prüfterminen anlegen.
6. **Dokumente verwalten**: Betriebsanweisungen und Sicherheitsdatenblätter hochladen und **Offline vorhalten** einschalten.
7. **Wochenplan**: die erste Woche planen und veröffentlichen.

### Stundenzettel einrichten (Ergänzung vom 27.10.2026)

1. In PowerShell: `Get-Content C:\Gehirn\Baustellen-App\supabase\migrations\0002_stunden.sql -Raw -Encoding UTF8 | Set-Clipboard`
2. Bei Supabase im **SQL Editor** eine neue Abfrage öffnen, mit Strg+V einfügen, **Run**. Es muss „Success“ erscheinen.
3. Die geänderte Funktion `zeitplan` neu hochladen (Inhalt von `supabase/functions/zeitplan/index.ts`), sobald sie eingerichtet ist. Sie löscht Stundenzettel nach 2 Jahren.
4. Genauso `supabase/migrations/0003_winworker_mitarbeiter.sql` ausführen (Mitarbeiter-Index für WinWorker). Erst danach die App hochladen, sonst lassen sich Personen nicht speichern.
5. App neu hochladen: `npm.cmd run deploy`.
6. Unter **Büro, Personen** bei jeder Person den **Mitarbeiter-Index in WinWorker** eintragen.

So funktioniert es: Jeder sieht auf „Heute“ die Karte **Stunden** mit den Zeiten aus dem Wochenplan und tippt „Stimmt so“ oder „Ändern“. Pause laut Arbeitsvertrag: Montag bis Donnerstag 60 Minuten, Freitag 30 Minuten. Fehlt ein Tag, erscheint er am nächsten Tag als „Noch offen“. Im Büro unter **Stunden** prüft Jannik die Woche, gibt frei und lädt **Excel für WinWorker** herunter. Freigegebene Tage kann der Mitarbeiter nicht mehr ändern. Die Excel-Datei passt zur Importkonfiguration „Excel Stundenmitschreibungsimport“ in WinWorker: A Mitarbeiter (WW-Index), B Projekt (WinWorker-Nummer der Baustelle), C Start (Datum und Uhrzeit), D Dauer in Stunden ohne Pause, E bis I leer, ab J nur zur Kontrolle (Name, Baustelle, Zeit, Pause, Notiz). Zeile 1 ist die Überschrift. Die Spalten stehen in `src/lib/stunden.ts` unter `EXPORT_SPALTEN`.

## 9. Auf die Handys bringen

Jede Person bekommt die Adresse `https://app.maler-riesa.de` und meldet sich mit ihrer E-Mail an.

* **iPhone (Paula)**: in **Safari** öffnen, unten auf **Teilen** tippen, **Zum Home-Bildschirm**. Danach nur noch über das Symbol öffnen. Unter **Mehr** die Benachrichtigungen einschalten. Das geht auf dem iPhone nur so und erst ab iOS 16.4.
* **Android (Mia)**: in **Chrome** öffnen, Menü mit drei Punkten, **App installieren** oder **Zum Startbildschirm hinzufügen**. Unter **Mehr** die Benachrichtigungen einschalten.

Vorher die Datenschutzinformation und die Vereinbarung zur Nutzung des Privathandys aus dem Ordner `dokumente` aushändigen und unterschreiben lassen.

## 10. Datenschutz und Verträge

| Was | Wo | Erledigt |
| --- | --- | --- |
| Auftragsverarbeitungsvertrag (AVV) mit Supabase | Supabase Dashboard, **Organization Settings**, **Legal Documents**, dort das DPA anfordern und unterschreiben | ☐ |
| AVV mit Cloudflare | gilt nach den Cloudflare-Bedingungen automatisch, unter https://www.cloudflare.com/cloudflare-customer-dpa/ herunterladen und ablegen | ☐ |
| AVV mit dem E-Mail-Anbieter (SMTP aus Schritt 2) | beim IT-Dienstleister bzw. Mail-Anbieter anfragen | ☐ |
| Verzeichnis der Verarbeitungstätigkeiten um „Baustellen-App“ ergänzen | Vorlage in `dokumente/Datenschutzinformation.md` (Abschnitt Zwecke und Fristen) | ☐ |
| Datenschutzinformation an alle Nutzer | `dokumente/Datenschutzinformation.md`, Firmendaten ergänzen | ☐ |
| Vereinbarung Privathandy unterschreiben lassen | `dokumente/Vereinbarung-Privathandy.md` | ☐ |
| Datenschutzinformation in der App aktualisieren | Datei `public/datenschutz.html`, Firmendaten ergänzen, dann `npm run deploy` | ☐ |

**Annahme, bitte prüfen:** Supabase und Cloudflare sind US-Unternehmen. Die Daten liegen in Frankfurt, trotzdem gelten die Standardvertragsklauseln bzw. das EU-US Data Privacy Framework, die in den jeweiligen AVV enthalten sind. Das ist für einen Handwerksbetrieb üblich, sollte aber im Verzeichnis der Verarbeitungstätigkeiten so vermerkt werden.

### Löschkonzept (macht der Zeitplan jede Nacht automatisch)

| Daten | Gelöscht nach |
| --- | --- |
| Krankmeldung (nur Datum, nie ein Grund) | 90 Tage nach dem letzten Krankheitstag |
| Abwesenheitseintrag daraus („abwesend“) und Berufsschule | 2 Jahre |
| Urlaubsanträge | Ende des Folgejahres |
| Wochenplan und Bestätigungen | 2 Jahre |
| Stundenzettel (vorher in WinWorker übernommen, dort liegt der Nachweis nach Arbeitszeitgesetz) | 2 Jahre |
| Erledigte Meldungen | 1 Jahr nach Erledigung |
| Benachrichtigungen | 30 Tage |
| Ausgeschiedene Personen samt Anmeldung | 90 Tage nach „Zugang endet am“ |
| Dateien, auf die nichts mehr verweist | nach 2 Tagen |

Lieferscheine, Fotos und Dokumente bleiben, solange die Baustelle existiert. Die App ist kein Archiv: Lieferscheine als PDF exportieren und wie bisher ablegen, abgeschlossene Baustellen nach Abschluss der Gewährleistung löschen.

## 11. Grenzen des kostenlosen Tarifs

| Grenze | Kostenlos | Schätzung für 4 bis 6 Personen (Annahme) |
| --- | --- | --- |
| Datenbank | 500 MB | unter 50 MB nach 3 Jahren |
| Dateien (Fotos, Lieferscheine, Dokumente) | 1 GB | Fotos werden auf etwa 300 KB verkleinert, Lieferscheine auf etwa 250 KB je Seite. 10 Fotos und 3 Lieferscheine am Tag ergeben etwa 0,8 GB im Jahr. |
| Benutzer | 50.000 | 6 |
| Sicherung | keine automatische | einmal im Monat unter **Einstellungen**, **Sicherung herunterladen** und auf dem Büroserver ablegen |

Wird der Speicher knapp, gibt es zwei Wege: alte Baustellen mit ihren Fotos löschen oder zu Supabase Pro wechseln (etwa 25 US-Dollar im Monat, über dem Budget). Supabase warnt vorher per E-Mail.

## 12. Wenn etwas nicht geht

| Beobachtung | Ursache und Abhilfe |
| --- | --- |
| Es kommt kein Code per E-Mail | SMTP aus Schritt 2 prüfen, Spam-Ordner prüfen, in Supabase unter **Authentication**, **Logs** nachsehen |
| „Für diese E-Mail-Adresse gibt es keinen Zugang“ | Person in der App angelegt, aber **Anmeldung freischalten** nicht gedrückt |
| Angemeldet, aber leere App | Die E-Mail der Anmeldung stimmt nicht mit der E-Mail unter **Personen** überein |
| Keine Benachrichtigungen | Unter **Mehr** steht der Grund. Auf dem iPhone nur vom Startbildschirm. Außerdem: Logs des Zeitgebers (Schritt 7) und der Funktion `zeitplan` in Supabase |
| Roter Balken „vom Server abgelehnt“ | Unter **Mehr** steht, was abgelehnt wurde, meistens fehlende Rechte. Liste leeren und im Büro neu eintragen |
| Supabase meldet „Project paused“ | Der Zeitgeber läuft nicht. Schritt 7 prüfen, Projekt im Dashboard mit **Restore** wieder starten |

## 13. Was in Version 1 bewusst fehlt

Chat, Leiharbeiter-Zugänge mit eingeschränkter Sicht und der Import der Maschinenliste aus einer Datei kommen in Version 2. Die Rechenregeln zum Jugendarbeitsschutz sind vereinfacht und warnen nur. Vor dem Echtbetrieb einmal gegen das Jugendarbeitsschutzgesetz prüfen (Datei `src/lib/regeln.ts`, Funktion `planWarnungen`).

**Noch nicht im Echtbetrieb erprobt (Annahme):** Der Versand der Benachrichtigungen aus der Supabase-Funktion über das Paket `web-push` und die Anmeldung per Code ließen sich hier nur ohne echte Supabase-Verbindung testen. Beides gehört deshalb an den Anfang des Testplans in Schritt 6.
