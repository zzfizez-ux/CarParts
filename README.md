# CarParts

Die Website läuft auf GitHub Pages. Der Fahrzeugkatalog, die Herstelleranwendungen, die Händlersuche und die Anmeldung laufen über Supabase. `index.html` ist der Einstieg. Die früheren Versions-URLs führen zum aktuellen Teilefinder.

[CarParts öffnen](https://zzfizez-ux.github.io/CarParts/)

## Geführte Teilesuche ohne eBay

CarParts nutzt den vorhandenen Herstellerkatalog, Händlerproduktseiten und optional **Serper**. Der Ablauf fragt fehlende Angaben gezielt nach und hält Recherchetreffer von belegten Fahrzeuganwendungen getrennt. eBay, Auto Parts Finder und Mwmbl werden vom aktuellen Such-Endpunkt nicht aufgerufen.

Die vollständige Struktur, Kostenrechnung und Einrichtung stehen in [docs/TEILESUCHE.md](docs/TEILESUCHE.md). Für die breite Webrecherche wird nur das Supabase-Secret **`SERPER_API_KEY`** benötigt. Ohne dieses Secret bleiben Katalog und Rückfragen nutzbar; neue Serper-Webtreffer sind dann nicht verfügbar.

```sh
npm ci
npm test
```

Node.js 24 oder neuer. Die Tests prüfen unter anderem den tatsächlichen Suchhandler mit kontrollierten Providerantworten, Produktmetadaten, Rückfragen, Referenzabgleich und widersprüchliche Ausstattungen. Sie ersetzen keinen Test der Live-Abdeckung mit einem eigenen Serper-Schlüssel.

## Betrieb

- Der Browser verwendet die öffentliche Supabase-Projektkennung. Herstellerdaten, geprüfte Artikel und OE-Referenzen sind lesbar. Die privaten Recherche- und Budgettabellen werden von den Edge Functions geschrieben.
- Die SQL-Dateien in [supabase/sql](supabase/sql) dokumentieren den Recherchecache, die Baureihen der geprüften Anwendungen, den Golf-Ölfilter und das Händlerbudget.
- Die produktiven Edge Functions sind `live-web-search`, `research-parts`, `discover-parts` und `login-notification`. `live-web-search` verwendet die TypeScript- und Moduldateien im gleichnamigen Ordner.
- `backend/` enthält die optionale Cloudflare-/D1-Implementierung. Ein leerer `baseUrl` in `catalog-config.js` wählt den produktiven Supabase-Pfad.
- Die Content Security Policy in `index.html` beschränkt Skripte und Netzwerkziele. Bei einem Wechsel des Supabase-Projekts oder der Aktivierung des optionalen Cloudflare-Backends muss die neue API-Origin auch in `connect-src` aufgenommen werden.
- Die Importfunktion wird über [catalogue_import.sql](supabase/sql/catalogue_import.sql) eingerichtet. Der serverseitige Import ist ausschließlich mit der Supabase-Servicerolle möglich.

## Teilekatalog erweitern

Der [Startbestand für acht Fahrzeugmarken](catalogue/de-passenger-cars-2026-11.json) enthält einzeln überprüfte Herstelleranwendungen mit Quellen und die Preisbeobachtungen vom 22. November 2026. Er dient als Vorlage für weitere Datenlieferungen.

Die Daten für [Bremsen und Kupplung](catalogue/de-brakes-and-clutch-2026-11.json) und [Lenkung, Wartung und Klassiker](catalogue/de-steering-service-classics-2026-11.json) stammen aus der Recherche einzelner Fahrzeuganwendungen und öffentlich einsehbarer Herstellerquellen. Die JSON-Dateien enthalten die verlinkten Belege und die eingeschränkten Baureihen, Baujahre, Positionen und Ausstattungsmerkmale pro Artikel. Hersteller, Teilenummer und Fahrzeuganwendung bilden die Identität für den Import.

Der [weitere Modellbestand](catalogue/de-more-models-2026-11.json) ergänzt Audi A6 C7 Limousine und Q5 8R, BMW 120d F20, X3 F25 und X5 E70, Mercedes A 180 W176 und E 220 CDI W212, Opel Insignia A Schrägheck sowie den Polo V 1.2 TSI. Die Anwendungen wurden nach Motorcode und Leistung gegen Brembo und den MANN-FILTER-Katalog geprüft. Continental ergänzt Koppelstangen für den Golf VII und einen Keilrippenriemensatz mit Fahrgestellnummer-Bedingung für den Insignia. Die Händlerpreise tragen jeweils den tatsächlichen Abrufzeitpunkt; sie sind keine dauerhaften Preiszusagen.

Bei Brembo widersprechen sich teilweise die englischen Gruppenüberschriften und die einzelnen Produktblätter. Die Produktart der Geber- und Nehmerzylinder wurde deshalb zusätzlich anhand der deutschen Produktblätter geprüft. Der Import verhindert, dass Brembo-M-Hauptbremszylinder und Brembo-C-Kupplungsgeberzylinder vertauscht werden. Alle bestehenden Bauteilbedingungen bleiben Teil der jeweiligen Fahrzeuganwendung.

Für ein neues Projekt ergänzt [catalogue_german_models.sql](supabase/sql/catalogue_german_models.sql) die Fahrzeugmodelle der beiden Recherchedateien im vorhandenen Fahrzeugkatalog.

```sh
node tools/import-reviewed-parts.cjs catalogue/de-passenger-cars-2026-11.json
node tools/import-reviewed-parts.cjs catalogue/de-passenger-cars-2026-11.json --apply
```

Der erste Befehl validiert die Datei. Der zweite schreibt die Daten in atomaren Paketen und benötigt `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` in einer privaten Laufzeitumgebung. Ein erneuter Import aktualisiert denselben Artikel und dieselbe Fahrzeuganwendung. Die jüngste Preisbeobachtung zum jeweiligen Händlerprodukt bleibt maßgeblich.

[Händlerbeobachtungen mit Bildern](supabase/sql/catalogue_offer_images.sql) ergänzt den Import um Bildverweise auf das tatsächlich geprüfte Händlerprodukt. Verifizierte Live-Angebote für bekannte Herstellerartikel werden ebenfalls mit Preis, Währung, Bildverweis, Quelle und Abrufzeitpunkt gespeichert. Dafür ist die private Funktion `save_catalogue_offer_observations` ausschließlich für die Servicerolle freigegeben. Der Browser zeigt solche Angebote höchstens sieben Tage ab dem Abruf an. Bilder werden von der Händlerquelle geladen und mit einem Link zur Bildquelle gekennzeichnet. Die Datei enthält die Datenbankänderung einschließlich der aktualisierten Importfunktion und wird nach `catalogue_import.sql` angewendet.

- Jede Zeile enthält den CarParts-Marke-/Modellnamen, die konkrete Motorbezeichnung, Baureihenschlüssel, Anwendungsjahre, Teilehersteller, Artikelnummer und eine Herstellerquelle. `engine_year_from` und `engine_year_to` beschreiben optional das weitere Produktionsfenster des Fahrzeugs. Für die Artikelsuche gilt das Anwendungsfenster.
- `oe_numbers` enthält die Originalreferenzen des Herstellers. `offers` enthält einzelne Händlerproduktlinks, beobachteten Preis, Währung, Datum und Quelle. `images` enthält das konkrete Produktfoto, seine Quelle und die Freigabe für die Anzeige.
- Suche in öffentlich einsehbaren Anwendungen zuerst nach Baureihe und Motor, dann nach der Teilenummer. Prüfe die OE-Referenz, wenn mehrere Teile mit derselben Bezeichnung gelistet werden. Ein gefundener API-Hinweis kann zur weiteren Recherche beitragen. Der Import übernimmt für den Katalog die geprüfte Herstelleranwendung.

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
