# CarParts

Die Website läuft auf GitHub Pages. Der Fahrzeugkatalog, die Herstelleranwendungen, die Händlersuche und die Anmeldung laufen über Supabase. `index.html` ist der Einstieg. Die früheren Versions-URLs führen zum aktuellen Teilefinder.

[CarParts öffnen](https://zzfizez-ux.github.io/CarParts/)

## Fahrzeug- und Teilesuche

Die Auswahl verwendet Marke, Modell, Baureihe, Baujahr und Motor. Dokumentierte Motoren sind in `car_engines.series_keys` einer oder mehreren Baureihen zugeordnet. Eine Artikelnummer wie `PU 8014` und `PU8014` wird gleich behandelt. Hinterlegte OE-Referenzen sind ebenfalls suchbar. Die Artikelkarte zeigt die Herstellerquelle und die Bedingungen der Anwendung.

`live-web-search` sucht zuerst nach Händlerprodukten für dokumentierte Teilenummern und weiteren eindeutigen Baureihen-Treffern. CarParts liest Artikelname, EUR-Preis und Produktbild aus der Produktseite. Fehlen Händlerprodukte, kann Mwmbl weitere Händlerseiten liefern. Der sichtbare Preis enthält einen Abrufzeitpunkt. Einbauposition, Motorcode, OE-Nummer und Ausstattungsbedingungen stehen bei der jeweiligen Quelle.

Angebote werden vier Stunden in `shared_parts_research` wiederverwendet. Quellen ohne Produktangebot werden eine Stunde gespeichert. Leere Abfragen werden kürzer zwischengespeichert. Die Datenbank zählt direkte Händlerabfragen und Mwmbl-Websuchen getrennt. Die Tagesgrenzen liegen bei 100 Händlerrecherchen und 25 Mwmbl-Recherchen pro UTC-Tag. Im Protokoll erscheinen Händlerdomain und Fehlergrund. Preise und Produktbilder hängen von der Abdeckung und den öffentlich abrufbaren Produktdaten ab.

`research-parts` verwaltet Kategorienachfragen und hinterlegte Herstellerreferenzen. `discover-parts` findet offene Ölfilterreferenzen aus OilSpec Commons. OBD-Suchen lesen die Diagnosehinweise aus `open_diagnostic_parts`. Die VIN-Prüfung nutzt NHTSA vPIC. Fahrzeugfotos mit lesbarer VIN werden per Tesseract im Browser verarbeitet. Die Fahrzeuggarage speichert die Auswahl auf dem aktuellen Gerät.

[MANN-FILTER HU 7020 z für den Golf VII](https://www.mann-filter.com/de-de/katalog/suchergebnisse/produkt.html/hu7020z_mann-filter.html) · [Mwmbl-Bedingungen und Lizenz der Suchergebnisse](https://developer.mwmbl.org/terms/)

## Betrieb

- Der Browser verwendet die öffentliche Supabase-Projektkennung. Herstellerdaten, geprüfte Artikel und OE-Referenzen sind lesbar. Die privaten Recherche- und Budgettabellen werden von den Edge Functions geschrieben.
- Die SQL-Dateien in [supabase/sql](supabase/sql) dokumentieren den Recherchecache, die Baureihen der geprüften Anwendungen, den Golf-Ölfilter und das Händlerbudget.
- Die produktiven Edge Functions sind `live-web-search`, `research-parts`, `discover-parts` und `login-notification`. `live-web-search` verwendet die TypeScript- und Moduldateien im gleichnamigen Ordner.
- `backend/` enthält die optionale Cloudflare-/D1-Implementierung. Ein leerer `baseUrl` in `catalog-config.js` wählt den produktiven Supabase-Pfad.
- Für einzeln geprüfte Herstelleranwendungen validiert `node tools/import-reviewed-parts.cjs approved-records.json` eine Quelldatei. Die Freigabe erfolgt mit `--apply` und den serverseitigen Supabase-Zugangsdaten. Für neue Baureihen werden die stabilen Zuordnungsschlüssel als `series_keys` mitgeliefert.

## Konto und E-Mails

Die Anmeldung über Supabase Auth ist oben rechts erreichbar. Der Browser behält die Sitzung und erneuert sie während der Nutzung. Für Kundenmails benötigt das Supabase-Projekt einen bestätigten Absender und einen eingerichteten SMTP-Dienst.

Für die GitHub-Pages-Website in Supabase **Authentication → URL Configuration** die Adresse `https://zzfizez-ux.github.io/CarParts/` als **Site URL** und als **Redirect URL** eintragen. Bereits verwendete weitere Redirect URLs in der Liste lassen.

Mit dem Supabase-Standardversand enthält die Passwort-Reset-Mail einen Link, der das Formular für das neue Passwort öffnet. Für die CarParts-Mail mit Einmalcode zuerst unter **Authentication → Emails → SMTP Settings** den eigenen Versand einrichten. Dann unter **Reset password** den Betreff **Passwort für dein CarParts-Konto zurücksetzen** und den HTML-Inhalt aus [recovery.html](supabase/templates/recovery.html) speichern. Der Button in der CarParts-Mail öffnet das Codeformular. Der Code wird erst bei der Eingabe und Prüfung verwendet.

Die Edge Function `login-notification` sendet die Benachrichtigung nach verifiziertem Passwortlogin über Resend. Dafür werden `RESEND_API_KEY` und `CARPARTS_MAIL_FROM` als serverseitige Funktionsvariablen hinterlegt. Ein Testkonto mit zustellbarer Adresse dient zur Abnahme von Registrierung, Sitzungswiederherstellung, Anmeldebenachrichtigung und Passwort-Reset.

[Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [E-Mail-Vorlagen](https://supabase.com/docs/guides/auth/auth-email-templates)

## Umzug auf IONOS Webhosting

Der Export enthält die Website für den IONOS-Webspace. Supabase bleibt für Konten, Fahrzeugdaten, Recherchecache und Edge Functions zuständig. Die Website lässt sich am Domainstamm oder in einem Unterverzeichnis ablegen. Die Pfade der Website-Dateien sind relativ.


```sh
node tools/prepare-ionos.mjs ../carparts-ionos
```

Für den späteren Upload kann die endgültige HTTPS-Adresse als zweites Argument angegeben werden, etwa `https://carparts.example/`. Damit erhält jede alte Versions-URL den passenden kanonischen Verweis. Der ausgewählte Ausgabeordner enthält auch die `.htaccess` für den JavaScript-MIME-Typ der `.mjs`-Dateien.

1. Den Inhalt des Exportordners einschließlich `.htaccess` per SFTP in den mit der IONOS-Domain verbundenen Webspace-Ordner laden. Danach die Seite über HTTPS öffnen.
2. In den Supabase Edge Function Secrets `CARPARTS_ALLOWED_ORIGINS` auf die erlaubten HTTPS-Origins setzen. Für einen Paralleltest gehören die GitHub-Pages-Origin und die neue Origin kommasepariert in die Liste, etwa `https://zzfizez-ux.github.io,https://carparts.example`. Origins enthalten keinen Unterverzeichnispfad.
3. In Supabase Auth unter **URL Configuration** die exakte neue URL mit abschließendem Schrägstrich zu **Redirect URLs** hinzufügen. Zum Umstieg auch **Site URL** und das Edge Function Secret `CARPARTS_SITE_URL` auf diese Adresse setzen. Die Edge Function nutzt sie in Anmeldebenachrichtigungen.
4. Auf der neuen Adresse die Fahrzeugauswahl, eine Teilesuche bis zum Händlerangebot, Anmeldung und Passwort-Reset prüfen. Bei einer neuen Domain melden sich Kunden mit ihrem vorhandenen Konto erneut an. Der Garagenspeicher des Browsers ist an die bisherige Domain gebunden.

[IONOS SFTP](https://www.ionos.de/hilfe/hosting/ftp-zugaenge-einrichten-und-verwalten/dateien-per-sftp-mit-filezilla-uebertragen/) · [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets) · [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## Datenquellen

- Der [Modellindex](series-index.js) und die [lokalen Markendateien](data/series/) sind bearbeitete Daten aus [vehicle-makes-models](https://github.com/gor3a/vehicle-makes-models/tree/ad1d97654d7ac50b393bfeafad3b8b21f5f15657) mit Fahrzeugdaten von autoevolution.com. Lizenz [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- [VehiclesDB](https://vehiclesdb.com) liefert offene Registerbelege zu Modellnamen unter CC BY 4.0. Der [Snapshot](data/vehicle-registry-evidence-2026.11.12.json) und die [Register-Quellennachweise](data/VEHICLESDB-ATTRIBUTION.md) liegen im Repository.
- Die [Diagnose-Bauteilhinweise](data/open-diagnostic-part-hints.json) sind eine bearbeitete Auswahl aus den [MechanicDB Developer Samples](https://github.com/MechanicDB/MechanicDB-public) unter ODbL 1.0.
- `open-oilfilters-data.js` ist ein gefilterter Snapshot aus `vehicles.csv` und `filter_sets.csv` von [OilSpec Commons](https://github.com/carbonautorepair/oilspec-commons) unter [CC0 1.0](https://github.com/carbonautorepair/oilspec-commons/blob/main/LICENSE).
