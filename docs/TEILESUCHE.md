# CarParts: suchen, prüfen, Rückfragen stellen

## Kleinster sinnvoller Aufbau

| Baustein | Aufgabe | Zusätzliche API nötig? |
| --- | --- | --- |
| Bestehende Website | Fahrzeugauswahl, Teilebegriff, Rückfragen und Produktkarten | Nein |
| Bestehendes Supabase-Projekt | Herstelleranwendungen, OE-Nummern, Suchdienst und globale Abruflimits | Kein neues Projekt |
| Serper Google Search API | Weitere Webseiten zu Bauteil, Fahrzeug und Referenz finden | Ein eigener Schlüssel |
| Erreichbare Händlerseiten | Tatsächlichen EUR-Preis, Produktbild und Beschreibung liefern | Kein zusätzliches KI-Abo |
| Gemeinsame Abgleichregeln | Motoranwendung, Teilenummer, Seite, Achse und bekannte PR-Codes abgleichen | Nein |

Der aktuelle Suchablauf ruft weder eBay noch RapidAPI/Auto Parts Finder noch Mwmbl auf. Ältere Importwerkzeuge und Daten bleiben für bestehende Katalogeinträge erhalten. Ein kostenpflichtiges Abo wird nicht automatisch abgeschlossen.

## Was du jetzt einrichten musst

1. Auf https://serper.dev/ ein Konto anlegen. Der Anbieter bewirbt 2.500 kostenlose Testabfragen ohne Kreditkarte; für spätere Guthabenkäufe wird PayPal akzeptiert.
2. Den API-Schlüssel im Serper-Dashboard abrufen.
3. Unter https://supabase.com/dashboard/project/umhzxsryqhwzxrmkbmwp/functions/secrets das Secret `SERPER_API_KEY` mit diesem Schlüssel speichern. Den Schlüssel weder in GitHub noch in den Chat einfügen.
4. Auf der Website ein Fahrzeug und eine Teilebezeichnung auswählen, bekannte Rückfragen beantworten und suchen. Zusätzliche Webquellen werden als **Serper** gekennzeichnet.

Die Website kommuniziert mit dem bestehenden Supabase-Endpunkt. Der Schlüssel bleibt auf dem Server. Der Provider wird anhand des Secrets automatisch verwendet; ein weiteres Deployment allein wegen des Schlüssels ist nicht nötig.

## Kosten und Grenzen zum Start

Stand 24.11.2026: Serper bewirbt **2.500 kostenlose Testabfragen ohne Kreditkarte**. Das spätere Starterpaket bietet **50.000 Credits für 50 USD zuzüglich möglicher Steuern**; gekaufte Credits gelten sechs Monate. Es gibt kein zwingendes Monatsabo. **PayPal wird ausdrücklich akzeptiert.** Zuerst kostenlos testen und erst bei Bedarf den tatsächlichen Endpreis in Euro im Checkout prüfen; 50 USD plus Steuern müssen nicht in dein Budget von 50 € passen.

Der bestehende Datenbankzähler erlaubt höchstens **25 neue Webabfragen pro UTC-Tag für die ganze Website**, nicht pro Besucher. Das ergibt höchstens 775 neue Webabfragen in 31 Tagen. Der Anschluss fordert nur zehn organische Ergebnisse pro Standardabfrage an. Es gibt keine automatische kostenpflichtige Zusatzabfrage und keinen automatischen Guthabenkauf.

Zusätzlich gelten **100 neue Händlerrecherchen pro UTC-Tag** und eine kurze Sperrzeit für wiederholte identische Abfragen. Bekannte komplette Händlerangebote benötigen keine zusätzliche Serper-Abfrage. Fehler führen nicht zu automatischen mehrfachen Serper-Abfragen. Die bestehenden Kosten und Kontingente von Hosting und Supabase gelten unabhängig davon weiter.

Serper-Ergebnisse werden ausschließlich kurzzeitig im Arbeitsspeicher gehalten, nicht als eigener Teilekatalog gespeichert. Herstellerbelegte Artikel und davon unabhängig beobachtete Händlerangebote haben eigene Quellen und Abrufzeitpunkte.

## Ablauf für Besucher

1. **Fahrzeug wählen:** Marke, Modell, Baureihe, Jahr und bekannte Motorisierung beziehungsweise Elektro-Variante.
2. **Bauteil eingeben:** freie Bezeichnung oder Teilenummer, einschließlich Verbrenner- und Elektroteilen.
3. **Fehlende Grundangaben ergänzen:** zum Beispiel genaue Motorisierung, Vorder-/Hinterachse oder linke/rechte Seite. Diese Rückfragen entstehen vor einer Webabfrage. Wer Angaben nicht kennt, kann ausdrücklich mit den vorhandenen Daten recherchieren.
4. **Quellen durchsuchen:** zuerst den Herstellerkatalog und bekannte Händlerprodukte, danach bei Bedarf Serper und erreichbare Händlerseiten.
5. **Zusätzliche Rückfragen:** eine OE-/Hersteller-Teilenummer oder ein tatsächlich am Fahrzeug vorhandener PR-Code kann die Auswahl eingrenzen. Es wird kein gewünschter PR-Code als Fahrzeugausstattung angenommen.
6. **Erneut abgleichen:** eingegebene Werte ändern die tatsächliche Suche und die Filter. Eine abweichende Achse, Seite, Referenz oder ein widersprechender bekannter PR-Code schließt den jeweiligen Katalogtreffer aus.
7. **Ergebnis ausgeben:** Produktname, tatsächlicher Händlerpreis mit Währung und Abrufzeit, Produktfoto, Beschreibung, Produktlink und Abgleichstatus. Daten werden nur angezeigt, wenn die Quelle sie liefert. Bei blockierten Seiten oder fehlenden Metadaten bleiben gegebenenfalls nur Quellenlinks bzw. der Katalogartikel mit einer Kennzeichnung der fehlenden Produktdaten.

Rückfragen werden während der aktuellen Fahrzeug-/Teilesuche gehalten und beim Wechsel zurückgesetzt. Sie werden nicht als neues Garagenprofil gespeichert. Die Suche fragt keine VIN ab und akzeptiert keine VIN in den Zusatzfeldern. Suchkriterien und Referenzen können Bestandteil des serverseitigen Recherchecaches und der Provideranfrage sein.

## Was die Statusangaben bedeuten

| Status | Aussage |
| --- | --- |
| Angaben fehlen | Bekannte Zusatzdaten können die Auswahl eingrenzen. |
| Herstelleranwendung gefunden | Eine dokumentierte Anwendung existiert; die konkrete Ausführung muss weiter abgeglichen werden. |
| Teilenummer und Herstelleranwendung stimmen überein | Eingegebene Referenz, dokumentierter Motor und bekannte eingegebene Merkmale stimmen überein. Weitere Bedingungen im Originalbeleg gelten weiterhin. |
| Recherchetreffer, Passform nicht bestätigt | Ein Händlerangebot oder eine Webseite wurde gefunden, aber die konkrete Fahrzeugzuordnung ist nicht belegt. |
| Herstellerzuordnung fehlt | Auch nach vollständigen Antworten liegt kein passender Beleg vor. Das Ausfüllen des Formulars allein bestätigt nichts. |

Es wird kein Prozentwert als Teile-Passgarantie vergeben. Weder eine Websuche noch eine OE-Nummer allein beweist sämtliche Ausstattungsbedingungen. Beispielsweise können Produktionsdatum, Bremsanlage, Anschlüsse, Softwarestand oder weitere Herstellerbedingungen entscheidend sein. Die Rückfragen unterstützen derzeit Motorvariante, OE-/Herstellernummer, Achse, Seite und aus den Katalognotizen lesbare PR-Codes. Andere Bedingungen bleiben ausdrücklich im Originalbeleg zu prüfen; die Software wertet nicht beliebige Freitextbedingungen vollständig aus.

Es gibt keinen Vollständigkeitsanspruch für alle Fahrzeuge und Bauteile. Für einen umfassenderen, strukturierten Fahrzeug-Teile-Katalog ist später ein geeigneter lizenzierter Datenlieferant erforderlich. Für den Start wird keine solche Lizenz als Bestandteil der 50 € versprochen.

## Dateien und Prüfung

- `search-guide-ui.js`: Rückfrageformular und erneute Suche.
- `supabase/functions/live-web-search/search-guide.mjs`: Eingabeprüfung, gemeinsame Regeln und Rückfrageplanung.
- `supabase/functions/live-web-search/index.ts`: Ablauf, Datenbankbudgets und Serper-Anschluss.
- `supabase/functions/live-web-search/offers.ts`: begrenzter Abruf zugelassener Händlerseiten und Produktmetadaten.
- `supabase-catalog.js`: Browserzugriff auf Herstellerdaten und Suchendpunkt.
- `tests/search-guide.test.mjs`: Abgleichregeln, Rückfragen und Eingabegrenzen.
- `tests/guided-search-handler.test.mjs`: kompletter Suchhandler mit kontrollierten Händler- und Serper-Antworten.

Anbieterquellen: https://serper.dev/ · https://serper.dev/playground · https://supabase.com/docs/guides/functions/secrets
