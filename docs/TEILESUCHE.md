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

Der bestehende Datenbankzähler erlaubt höchstens **50 Providerabfragen pro UTC-Tag für die ganze Website**, nicht pro Besucher. Das ergibt höchstens 1.550 Providerabfragen in 31 Tagen. Der Anschluss verwendet das vorhandene Serper-Konto für strukturierte Shopping-Angebote (bis zu 20 Treffer). Wenn noch kein komplettes Angebot vorliegt, darf eine zusätzliche Standard-Webabfrage mit bis zu zehn organischen Treffern folgen. Jede der höchstens zwei Provideranfragen benötigt eine eigene Reservierung aus dem gemeinsamen Tageslimit. Das Limit entspricht damit bis zu 25 vollständigen Recherchen mit jeweils zwei Provideranfragen; reine Shopping-Recherchen benötigen nur eine. Es gibt keinen automatischen Guthabenkauf.

Zusätzlich gelten **100 neue Händlerrecherchen pro UTC-Tag** und eine kurze Sperrzeit für wiederholte identische Abfragen. Auch bei bekannten Händlerangeboten kann eine Shopping-Abfrage weitere Anbieter finden. Fehler führen nicht zu wiederholten Shopping-Versuchen. Die ergänzende Standard-Websuche bleibt ebenfalls vom gemeinsamen Limit abhängig. Die bestehenden Kosten und Kontingente von Hosting und Supabase gelten unabhängig davon weiter.

Die angereicherte Vergleichsansicht wird im bestehenden Recherchecache mit Quellenangaben und Abrufzeit begrenzt gespeichert: bei Produkten höchstens 60 Minuten, bei reinen Quellen höchstens 30 Minuten. Dadurch funktioniert ein erneuter Abruf auch auf einem anderen Suchserver ohne neue Providerabfrage. Suchergebnisse werden nicht als verifizierte Herstellerartikel übernommen. Herstellerbelegte Artikel und unabhängig beobachtete Händlerangebote behalten ihre eigenen Belege.

## Ablauf für Besucher

1. **Fahrzeug wählen:** Marke, Modell, Baureihe, Jahr und bekannte Motorisierung beziehungsweise Elektro-Variante.
2. **Bauteil eingeben:** freie Bezeichnung oder Teilenummer, einschließlich Verbrenner- und Elektroteilen.
3. **Fehlende Grundangaben ergänzen:** zum Beispiel genaue Motorisierung, Vorder-/Hinterachse oder linke/rechte Seite. Diese Rückfragen entstehen vor einer Webabfrage. Wer Angaben nicht kennt, kann ausdrücklich mit den vorhandenen Daten recherchieren.
4. **Quellen durchsuchen:** zuerst den Herstellerkatalog und bekannte Händlerprodukte, danach bei Bedarf Serper und erreichbare Händlerseiten.
5. **Optionale Zusatzangaben:** Teilenummer und Ausstattungscode sind standardmäßig eingeklappt. Niemand muss erst eine Nummer heraussuchen oder ein Teil ausbauen, um Angebote zu sehen. Bekannte Referenzen werden intern aus dem Herstellerkatalog verwendet. Nur wer eine Nummer bereits kennt, kann sie ergänzen. Ein PR-Code wird niemals aus einem gewünschten Treffer als Fahrzeugausstattung übernommen. Zusatzangaben lassen sich zurücksetzen.
6. **Erneut abgleichen:** eingegebene Werte ändern die tatsächliche Suche und die Filter. Eine abweichende Achse, Seite, Referenz oder ein widersprechender bekannter PR-Code schließt den jeweiligen Katalogtreffer aus. Widersprechen Zusatzangaben bereits der im Suchbegriff genannten Position, wird eine Korrektur verlangt. Bei ausdrücklich angegebener Teilenummer müssen auch weitere Quellen und Händlerprodukte diese Nummer oder eine dokumentierte Querverknüpfung belegen; allgemeine Suchtreffer reichen dann nicht aus.
7. **Ergebnis ausgeben:** Produktname, tatsächlicher Händlerpreis mit Währung und Abrufzeit, Produktfoto, Beschreibung, Produktlink und Abgleichstatus. Alle Produktangebote und weiteren Webquellen erscheinen im Angebotsvergleich. Fehlende Preise und Fotos bleiben ausdrücklich unbekannt. Eine Kategorie-, Ratgeber- oder blockierte Händlerseite wird nicht durch einen beliebigen Produktpreis ergänzt. Auch Produkte mit nur Preis oder nur Bild bleiben erhalten.

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

## Verständliche Begriffe und Tippfehler

Die gemeinsame, lokale Begriffserkennung sitzt in `supabase/functions/live-web-search/part-search.mjs`. Browser und Suchendpunkt verwenden dieselben Regeln. Das Verzeichnis enthält die bisherigen Kategorien sowie zusätzliche Steuergeräte, Sensoren und Aktuatoren. Es unterstützt Synonyme, deutsche und englische Alternativnamen, getrennt geschriebene Komposita und nahe Tippfehler einschließlich vertauschter Buchstaben. Es ist eine begrenzte Begriffserkennung, keine automatische Diagnose und keine Vollständigkeitsgarantie für jede freie Beschreibung.

| Eingabe | Verhalten |
| --- | --- |
| `bremsbelege vorne` | Suche nach `Bremsbeläge vorne`, Korrektur sichtbar |
| `brems beläge hinten links` | Suche nach `Bremsbeläge hinten links` |
| `pollenfilter` | Suche nach `Innenraumfilter` |
| `getriebe steuergerät` | Suche nach `Getriebesteuergerät` |
| `kupplung steuergerät` | Auswahl zwischen Getriebesteuergerät, Getriebemechatronik und Kupplungsaktuator mit kurzen Erklärungen |
| `HU 7020 z` / `P0420` | Originalnummer bzw. Fehlercode bleibt erhalten |

Vorschläge während der Eingabe benötigen keine Datenbank-, Händler- oder Serper-Abfrage. Bei mehrdeutigen Begriffen wird zuerst nach dem Bauteil gefragt. Auch ein direkter API-Aufruf erhält in diesem Fall `status: needs_clarification` und löst keine Recherche aus. Ein Klick auf einen Vorschlag übernimmt den Begriff und startet bei vorhandenem Fahrzeug die normale Suche. Der Knopf „Mit meiner ursprünglichen Eingabe suchen“ umgeht ausdrücklich die Begriffskorrektur; die bestehenden Quellen- und Passformprüfungen gelten weiter.

Bei einer Korrektur zeigt die Seite ursprüngliche und tatsächlich gesuchte Bezeichnung. Achse, Seite, Maße und unbekannte Zusatzanforderungen bleiben erhalten. Nummern werden nicht durch ähnlich geschriebene Artikel ersetzt. Nicht erkannte Begriffe bleiben als freie Suche zugelassen. Aus der Erkennung eines Bauteilnamens entsteht keine Herstellerzuordnung und keine Passformbestätigung. Händlerbezeichnungen wie „Steuergerät, Automatikgetriebe“ gelten ebenfalls als Getriebesteuergerät. Für die Webentdeckung werden angehängte Kataloganmerkungen im Motorlabel nicht als zwingende Suchwörter verwendet; das vollständige Originalfahrzeug bleibt für den Hersteller- und Konfliktabgleich erhalten. Die globalen Abruflimits und bestehenden Anbieter bleiben unverändert; eine weitere kostenpflichtige API wird nicht angebunden.

Die Unterscheidung zwischen Getriebesteuerung und Kupplungsaktuator orientiert sich an den Herstellerbeschreibungen von Bosch Mobility und ZF Aftermarket:
https://www.bosch-mobility.com/en/solutions/transmission-technology/transmission-control-unit/
https://aftermarket.zf.com/en/aftermarket-portal/knowledge-hub/inbrief-sachs-actuators/

## Preisvergleich und Empfehlungen

- Große Angebotskarten enthalten ausschließlich konkrete Produkte mit positivem EUR-Preis und Produktfoto. Quellen ohne Preis oder Bild stehen in einem geschlossenen Abschnitt unterhalb des Vergleichs. Lädt ein Bild nicht, verschwindet das Produkt aus dem Vergleich und aus den Empfehlungen; sein Link bleibt unter den ergänzenden Quellen erreichbar.
- Der Suchdienst verwendet zusätzlich den vorhandenen Serper-Shopping-Endpunkt. Er liefert einzelne Produktangebote mit Titel, Preis, Vorschaubild, Händlerlink und gegebenenfalls Produktbewertungen. Angaben bleiben als Google-Shopping-/Händlerdaten gekennzeichnet. Wenn die aktuelle API nur eine Produkt-ID bzw. eine Google-Produktansicht liefert, führt der Knopf ausdrücklich zu Google Shopping; es wird kein Händler-Direktlink erfunden. EUR-Preisspannen, monatliche Raten, Fremdwährungen und „ab“-Preise werden nicht als konkreter Artikelpreis übernommen.
- Zugelassene Kategorieseiten werden nach einzelnen Produktlinks und strukturierten Produktlisten durchsucht. Pro Seite werden höchstens zwei Produktlinks verfolgt. Es gibt keine unbeschränkte Shop-Durchsuchung. Bei Steuergeräten werden unter anderem Steckergehäuse, Dichtungen, Werkzeuge und Reparaturdienste ausgeschlossen, die Händler in derselben Kategorie aufführen.
- Sortierung nach Preis, bekanntem Gesamtpreis und Produktbewertungen sowie Filter für Händler und bekannte Hersteller laufen im Browser, ohne neue Provideranfrage.
- **Empfohlen** erscheint als eigener Bereich über den Angeboten und als Kennzeichnung am empfohlenen Produkt. Voraussetzungen: aktueller Preis (höchstens 24 Stunden), Foto, Herstelleranwendung oder dokumentierte OE-Querverbindung, keine bekannten offenen Abgleichpunkte oder Konflikte, keine bekannte Nichtlieferbarkeit sowie mindestens 4/5 aus mindestens fünf Produktbewertungen. Explizit gebrauchte oder überholte Artikel werden nicht empfohlen.
- Die Bewertungsrangfolge berücksichtigt die Anzahl: `(Bewertung × Anzahl + 3,5 × 20) / (Anzahl + 20)`. Angezeigt bleiben echte Durchschnittsbewertung und Anzahl. Der gewichtete Vergleichswert ist kein Qualitätsprozentwert und kein unabhängiger Material-/Haltbarkeitstest. Preis oder Markenname allein erzeugen keine Empfehlung. Ohne ausreichende Daten sagt der Bereich ausdrücklich, dass noch keine belegte Qualitätsempfehlung vorliegt.
- **Preis-Tipp** bezeichnet wie bisher den niedrigsten gelesenen Artikelpreis mit ausreichendem Fahrzeugabgleich. Lieferumfang und Versand können abweichen. Eine günstigere Alternative desselben Artikels wird nur bei gleichem Hersteller, gleicher Artikelnummer, gleichem Zustand und gleicher bekannter Packungsstückzahl hervorgehoben.
- Versand und Gesamtpreis werden nur aus eindeutigen Händlerdaten errechnet. Kurze Shopping-Versandhinweise können als Hinweise erscheinen, erzeugen aber keinen geschätzten Gesamtpreis.
- Ein Suchtreffer nach einer OE-Nummer allein erzeugt keine bestätigte Passform. Eine dokumentierte Herstelleranwendung wird bei Shopping-Angeboten nur übernommen, wenn Hersteller und konkrete Artikelnummer im Produkttitel übereinstimmen. Bei ausdrücklich als Original VW angebotenen Artikeln kann stattdessen eine im Titel sichtbare OE-Nummer mit einer bereits dokumentierten Fahrzeuganwendung verknüpft werden. Diese Querverbindung wird gesondert gekennzeichnet; der Artikel wird nicht als MANN-/Hengst-Artikel gespeichert und eine Originalitätsgarantie wird daraus nicht abgeleitet. Eigene eingegebene Referenzen und ausgeschlossene Anwendungen werden weiterhin geprüft.
- Verglichen werden die tatsächlich gefundenen Angebote, keine vollständige Abdeckung sämtlicher Firmen. Können Quellen keine Daten liefern oder ist das Budget ausgeschöpft, werden weder Preise noch Fotos oder Qualitätsurteile erfunden.

Quellen zum strukturierten Format und zur Datenherkunft: https://serper.dev/ · https://serper.dev/terms · https://schema.org/Offer · https://schema.org/AggregateRating

## Dateien und Prüfung

- `offer-comparison.js` / `offer-comparison-ui.js`: Zusammenführen, Karten, lokale Sortierung und transparente Empfehlungen.
- `supabase/functions/live-web-search/offer-facts.mjs`: explizite Produktbewertungen, Lieferumfang und Versanddaten.
- `search-guide-ui.js`: Rückfrageformular und erneute Suche.
- `supabase/functions/live-web-search/search-guide.mjs`: Eingabeprüfung, gemeinsame Regeln und Rückfrageplanung.
- `supabase/functions/live-web-search/index.ts`: Ablauf, Datenbankbudgets und Serper-Anschluss.
- `supabase/functions/live-web-search/offers.ts`: begrenzter Abruf zugelassener Händlerseiten und Produktmetadaten.
- `supabase-catalog.js`: Browserzugriff auf Herstellerdaten und Suchendpunkt.
- `tests/search-guide.test.mjs`: Abgleichregeln, Rückfragen und Eingabegrenzen.
- `tests/guided-search-handler.test.mjs`: kompletter Suchhandler mit kontrollierten Händler- und Serper-Antworten.

Anbieterquellen: https://serper.dev/ · https://serper.dev/playground · https://supabase.com/docs/guides/functions/secrets
