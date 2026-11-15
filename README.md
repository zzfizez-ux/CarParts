# CarParts — belegte Autoteile direkt auf der Website

**Stand 15.11.2026:** 41 kuratierte Automarken, 495 bekannte Modellreihen, 45 anklickbare Teilekategorien, **18 echte Artikelnummern und 23 durch Herstellerquellen belegte Fahrzeug-/Ausstattungsanwendungen** in Supabase. Die 45 Kategorien sind **Suchmöglichkeiten**, keine Produktlisten und keine bestätigten Passformen.

## Was tatsächlich verfügbar ist

### Belegte Herstellerartikel

- **MANN-FILTER PU 8014 / PU 8028**, VW Golf VII 2.0 TDI CRBC 150 PS: zwei unterschiedliche Kraftstofffilter für Gehäuse **mit bzw. ohne Wassersensor**.
- **MANN-FILTER W 712/94**, nach Herstellerkatalog für bestimmte Varianten von Audi A1, VW Polo, Touran und Tiguan.
- **MANN-FILTER HU 6004 x / HU 6014/1 z**, nach Herstellerdaten für BMW 3er F30/F31 mit konkret dokumentierten N47-/B47-Motoren. HU 6014/1 z ist der vom Hersteller genannte Ersatz für HU 6014 z.
- **MANN-FILTER HU 612/2 x**, Opel Corsa E 1.4 B14XEL 90 PS, Schaltgetriebe.
- **MANN-FILTER C 22 028**, Mercedes C-Klasse W205 und GLC X253 mit konkretem OM651.921-Motor.
- Weitere einzelne Herstelleranwendungen: **Renault Clio IV** (HU 10 002 z), **Hyundai i30** (HU 7001 x), **Nissan Qashqai II** (C 18 037), **Toyota Yaris III** (W 68/3), **Ford Focus III** (W 7015), **Mazda 3 BL** (W 712/73). Alle ausschließlich für die dokumentierten Motorcodes und Baujahre.
- **Brembo P 85 137 / P 85 126 / P 85 125**, Bremsbeläge für Golf VII 1.6 TDI 105 PS, **nur bei passender Vorder-/Hinterachse, Bremssystem und nachgewiesenem PR-Code**. Diese verschiedenen Artikel sind Alternativen für verschiedene Bremsanlagen, nicht gleichzeitig passende Artikel.
- **Brembo 09.C547.11 / 09.9145.11**, Bremsscheiben für unterschiedliche PR-Codes derselben Golf-VII-Ausführung.

Originalquellen: [MANN-FILTER Katalog](https://www.mann-filter.com/de-de/katalog.html), [Brembo Golf-VII-Teilekatalog](https://www.bremboparts.com/europe/en/catalogue/vw-golf-vii-5g1-bq1-be1-be2-1-6-tdi/000056145-1).

**Wichtig:** Ein Hersteller-Katalogeintrag bestätigt nur die aufgeführten Bedingungen. Das ersetzt keine Prüfung von Motorcode, Bauzeit, PR-Code, Abmessungen und Einbauposition. Bremskomponenten dürfen nicht allein anhand des Modellnamens gewählt werden.

### Live-Händlerpreise

Die beiden Golf-VII-Kraftstofffilter verfügen über manuell geprüfte Angebote von ATP Autoteile (Preisstand 15.11.2026):
- PU 8014: **24,34 €** – https://www.atp-autoteile.de/de/product/3695434-mann-filter-kraftstofffilter
- PU 8028: **26,24 €** – https://www.atp-autoteile.de/de/product/4011750-mann-filter-kraftstofffilter

Die Website blendet Angebote aus, sobald `observed_at` mehr als **sieben Tage** zurückliegt. Für alle anderen Artikel gilt derzeit **Preis nicht verfügbar**. Es gibt noch **keine freigegebenen Produktfotos**. Stattdessen zeigt CarParts klar gekennzeichnete originale Symbolzeichnungen. Urheberrechtlich geschützte Herstellerbilder werden nicht ohne dokumentiertes Nutzungsrecht übernommen.

### Alle Modelle / alle Teiletypen

Alle 495 Modellreihen können über die 45 Kategorien nach Bremsbelägen, Scheiben, Öl-/Kraftstoff-/Luftfiltern, Fahrwerk, Elektrik, Motor, Auspuff etc. durchsucht werden. Die Website nennt ausdrücklich, wenn kein belegtes Teil verfügbar ist, und zeigt die belegte Artikelanzahl für das gewählte Modelljahr. **495 vollständig abgedeckte Modelle sind das noch nicht.** Dafür ist ein umfangreicher autorisierter Hersteller-/Händlerdatenfeed erforderlich; den gibt es derzeit nicht kostenlos in diesem Projekt.

## Build 20: optionale Live-Händlerwebsuche für beliebige Ersatzteile

Die neue **Supabase Edge Function** `supabase/functions/live-web-search/index.ts` ist deployed. Sie unterstützt eine fahrzeugbezogene Websuche nach beliebigen Ersatzteilbezeichnungen, zum Beispiel Dacia Logan 2017 Bremsbeläge. Anders als OilSpec (nur Ölfilter) und unsere Brembo-Recherchekandidaten kann die neue Erweiterung nach aktuellen Händler-Webseiten suchen, **wenn ein seriöser Websuchanbieter autorisiert angeschlossen wurde**.

**Status:** Die Funktion ist technisch eingerichtet, aber **ohne hinterlegten Websuchanbieter-Schlüssel ist die Live-Websuche noch NICHT aktiv**. CarParts zeigt daher ausdrücklich „Live-Internetsuche noch nicht aktiviert“, anstatt vorgetäuschte Händlerangebote zu liefern. Bisherige belegte Herstellerteile, Community-Hinweise und die Kategorie-Suchhistorie funktionieren weiterhin.

### Datenschutz, Rechte, Nutzungskosten

- Anbieteradapter: [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search) über einen **serverseitig geheim gehaltenen** `TAVILY_API_KEY`. Die Anbieterbedingungen gelten; **ein berechtigter volljähriger Betreiber** muss diesen Zugang und seine Nutzungsbedingungen freigeben.
- Tavily erlaubt die Anzeige von Suchtreffern (Titel, URL, kurzer Auszug) in öffentlichen Anwendungen; Urheberrechte und Bedingungen der jeweiligen Shopseiten gelten weiterhin. Es werden keine ungeklärten Produktfotos übernommen.
- Betreiberseitige Konfiguration (nur nach Berechtigung): Supabase Edge Function Secret `TAVILY_API_KEY`. **Niemals** in HTML, JavaScript des Browsers oder GitHub-Commits speichern.
- `WEB_SEARCH_CACHE_ALLOWED=true` **erst nach Klärung der Rechte zur Wiederverwendung gemeinsamer Suchresultate** bei Tavily setzen. Ohne diese explizite Freigabe werden keine fremden Treffer in die geteilte CarParts-Datenbank übernommen.
- Der Server akzeptiert nur vordefinierte Automarken/Modelle und plausible Jahre, begrenzt Suchbegriffe und sperrt offensichtliche VINs. Er durchsucht eine feste Menge deutschsprachiger Autoteile-Händlerseiten. Es werden keine IP-Adressen, VINs oder Benutzerprofile protokolliert.
- Im kostenlosen Betrieb ist der Adapter auf **höchstens 25 unterschiedliche Websuchen pro Tag** begrenzt. Die Fremdanbieter-Kostenkontrolle bleibt erforderlich. Bei abgeschaltetem Schlüssel werden keine externen Such-API-Anfragen ausgelöst.
- Kein allgemeiner Websuchtreffer gilt als bestätigte Passform. Live-Suchkarten zeigen derzeit **keine behaupteten Produktfotos oder verbindlichen Händlerpreise**. Für diese sind gesondert autorisierte strukturierte Shop-Daten/Produktfeeds notwendig. Ein Titel, ein Auszug und ein Quellenlink können direkt auf CarParts angezeigt werden, solange die Nutzungsrechte eingehalten werden.
- Zusätzliche RLS-geschützte Tabellen `live_web_search_cache` und `live_web_search_budget`; der Browser kann dort nichts unmittelbar lesen oder schreiben.

Das Feature bedeutet also **„Live-Händlerwebsuche nach Anbindung eines berechtigten Providers“** – nicht „kostenlos und ohne Zugang automatisch das gesamte Internet vollständig mit Livepreisen und Bildern durchsuchen“. Diese Unterscheidung ist für eine verlässliche Teilewebsite entscheidend.

## Hersteller-Recherche und Suchanfragen (Build 19)

Das **Suchergebnis muss zwischen bestätigter Passform und bloßen Recherchekandidaten unterscheiden**. Der neue Ablauf:

1. CarParts fragt zuerst die bestehenden, genau auf Motor/Ausstattung bezogenen Hersteller-Teilezuordnungen in Supabase ab.
2. Bei einer Ölfiltersuche, für die keine Herstellerzuordnung vorliegt, fragt CarParts den CC0-OilSpec-Datensatz über die bestehende `discover-parts`-Funktion ab und speichert die ausdrücklich ungeprüften Referenzen.
3. Für weitere Teilekategorien ruft der Browser `supabase/functions/research-parts/index.ts` auf. Das Modul liest **bereits anhand offizieller Quellen recherchierte** Kandidaten aus `research_part_candidates` und zeigt sie direkt auf CarParts. Es speichert die angeforderte Kombination aus Marke, Modell, Baujahr und Teilekategorie in `research_part_requests`, wenn sie noch nicht vorhanden ist.
4. Wenn bislang keine erlaubte Quelle vorliegt, sagt die Website das ausdrücklich. **Die automatische Speicherung der Suchkategorie ist keine automatische Internetsuche und erzeugt keine neuen Produktdaten.** Ein universeller Websuche- oder Shop-Datenfeed ist noch nicht angeschlossen.

### Dacia Logan – dokumentierte Herstellerreferenzen

Der erste neue Recherchefall umfasst mehrere **Brembo-Bremsbeläge für verschiedene Logan-I-, Logan-II- und MCV-II-Bremsanlagen**. Die Einträge enthalten Hersteller-Artikelnummern, konkrete Modell-/Bauzeit-/Bremsscheibenvarianten und Direktlinks zu Original-Herstellerkatalogseiten.

- Logan I / LS: P 68 008 bei bestimmten **259-mm-Bremsscheiben**, P 68 038 bei bestimmten **238-mm-Bremsscheiben**, nicht austauschbar ohne Bremsanlagenprüfung.
- Logan II / MCV II: unter anderem P 68 059, P 68 060, P 68 065 und P 68 069, je nach Bauzeit, Motor, Bremssattel und Modellcode. Für einzelne Teile ist ein Wechsel im April 2015 dokumentiert.
- Quellen: [Brembo Logan I 1.4 LPG](https://www.bremboparts.com/europe/de/catalogue/dacia-logan-ls-1-4-mpi-lpg-ls0c/000004351-1), [Brembo Logan II 1.2](https://www.bremboparts.com/europe/de/catalogue/dacia-logan-ii-1-2/000114211-1), [Brembo Logan MCV II 1.5 dCi](https://www.bremboparts.com/europe/de/catalogue/dacia-logan-mcv-ii-1-5-dci/000057168-1).

**Es wird nicht behauptet, dass ein gelisteter Artikel zum ausgewählten Einzelwagen passt.** Auch die angenäherte Baujahreinschränkung ist keine exakte Fahrzeugfreigabe. Vor dem Kauf sind VIN, HSN/TSN, Bremsscheibendurchmesser, Motor und Herstellerhinweise zu überprüfen. Für Research-Kandidaten gibt es keine erfundenen Fotos oder Preise.

**API-/Lizenzgrenze:** Die kostenlos erreichbare Speero-API liefert für Dacia Logan unpassende Treffer, Saudi-Riyal-Preise und keine belastbaren Fahrzeug-Fitment-Angaben; die dokumentierte gemeinsame Cache-Dauer beträgt nur 300 Sekunden. Ihr Inhalt wird daher nicht dauerhaft kopiert oder als deutsche Ersatzteilsuche präsentiert. eBay Browse erfordert OAuth und Produktionsfreigabe; das ist hier noch nicht eingerichtet. Es gibt noch keine verlässliche, allgemein freigegebene kostenlose Live-Produktsuche für beliebige Fahrzeuge und Teilearten.

**Sicherheit:** Das Backend akzeptiert nur die 41 bekannten Marken, die 495 hinterlegten Modelle, vorgegebene Teilekategorien und ein plausibles Baujahr. Keine VIN, keine frei eingegebene Nachricht, keine IP und keine personenbezogenen Daten werden in der Suchanfragetabelle gespeichert. Die öffentlich erreichbare Funktion ist auf unseren Website-Ursprung und den Supabase-Publishable-Key beschränkt. Beide neuen Tabellen nutzen RLS; Browser dürfen Herstellerkandidaten nur lesen, die aggregierten Suchanfragen sind privat.

## Neue frei nutzbare Datenquelle: OilSpec Commons (CC0)

CarParts verwendet zusätzlich einen **öffentlich verfügbaren CC0-Datensatz**: [OilSpec Commons](https://github.com/carbonautorepair/oilspec-commons) von carbonautorepair. Die Daten wurden für unsere 41 bekannten Marken und kuratierten Modelle gefiltert und als `open-oilfilters-data.js` eingebunden.

- Quelldateien: `data/vehicles.csv` und `data/filter_sets.csv`, Lizenz: **CC0 1.0 Universal** ([LICENSE](https://github.com/carbonautorepair/oilspec-commons/blob/main/LICENSE)).
- 4.202 Modell-/Jahr-/Motor-Referenzen für **156 unserer Modelle aus 24 Marken** sind als Open-Data-Snapshot hinterlegt. Das sind **nicht** 4.202 belegte Fahrzeug-Teile-Passgenauigkeiten.
- Nur bei einer Suche nach **Ölfilter / Oil filter** und fehlendem Herstellerkatalogtreffer läuft die automatische Nachschlagefunktion: zuerst Supabase-Cache prüfen, bei fehlendem Eintrag serverseitig die freigegebene, auf eine feste GitHub-Version begrenzte CC0-Quelle abrufen, dann ausschließlich diese Quellenreferenzen als **unverified** in Supabase speichern. Bei Ausfall der Edge Function dient die lokale Quelle als Ausweichlösung.
- Besucher müssen zunächst eine **genaue Fahrzeug-/Motor-Zeile aus der Quelle** auswählen; erst dann erscheinen die veröffentlichten **WIX, MicroGard, Mobil 1 oder K&N**-Referenzen als **ungeprüfte Community-Hinweise**.
- **Qualitätsgrenze:** Der Quelldatensatz ist keine offizielle europäische Hersteller-Fitment-Datenbank und enthält teilweise US-Markt- und möglicherweise fehlerhafte Fahrzeugangaben. Die Quellreferenzen sind auf CarParts ausdrücklich als **NICHT FITMENTGEPRÜFT** gekennzeichnet. Ein Community-Filterhinweis darf nicht als passende Teilenummer oder Kaufempfehlung verstanden werden. Vor jedem Kauf die genaue Variante und aktuelle Herstellernummer abgleichen.
- Es werden keine Händlerpreise, Artikelfotos, OE-Nummern oder weiteren Teilekategorien erfunden. Herstellerbelegte Supabase-Artikel bleiben getrennt und haben Vorrang.
- Die Quelle ist frei kopierbar; die Integration nutzt **keine geschützten Händler-Scraper und keine kostenpflichtigen externen Provider**. Die Supabase Edge Function `discover-parts` verwendet ausschließlich serverseitig verwaltete Datenbank-Zugangsdaten; im Browser steht nur der öffentliche Publishable Key. Bei Erfolg sagt die Website, ob die Daten neu gespeichert oder aus der Datenbank geladen wurden.
- Die Suche speichert nur **Marke, Modell, Baujahr und frei lizenzierte Referenzzeilen**. Keine VIN, keine IP-Adressen, keine Nutzeridentität, keine freien Suchbegriffe. Für den kostenlosen Supabase-Tarif begrenzt der Server neue externe Quellenabrufe auf ein Tagesbudget, nutzt Zwischenspeicherung und erlaubt nur Marken/Modelle aus dem kuratierten Katalog.
- **Aktuelle Grenze:** Das ist eine echte automatische Suche und Datenbankanreicherung für **Ölfilterreferenzen aus genau einer lizenzierten CC0-Quelle**. Es ist kein beliebiger Internet-Crawler, keine vollständige OE-/Bremsenteile-Datenbank und keine Garantie der Teilepassform. Weitere Quellen brauchen einen gesonderten Lizenz- und Qualitätscheck.

**Warum keine fremden Shop-APIs ungefragt übernehmen?** Öffentlich aufrufbare Angebote sind nicht automatisch zur systematischen Einbindung in fremde Websites lizenziert. Zum Beispiel erlaubt Hubshops öffentliche API nur die gelegentliche Beratung und verbietet die automatisierte Befüllung fremder Websites ausdrücklich; APIs von Google Custom Search, TecDoc oder großen Marktplätzen verlangen oft Zugangsschlüssel oder Lizenzen. CarParts übernimmt darum nur Daten mit geeigneten Nutzungsrechten und zeigt ungesicherte Treffer klar getrennt.

## Automatischer Such- und Speichervorgang (Build 18)

```text
CarParts-Suche → Supabase Herstellerkatalog (belegt)
                 ↘ falls kein belegter Treffer bei "Ölfilter"
                   Edge Function discover-parts
                     → offene, geprüfte CC0-Quelldatei (nur bei Cache-Miss)
                     → Supabase open_oilfilter_cache (unverified)
                     → Ergebnis direkt auf CarParts anzeigen
```

Das Servermodul liegt unter `supabase/functions/discover-parts/index.ts` und ist bereits auf dem Supabase-Projekt bereitgestellt. Die Datenbankmigration legt `open_oilfilter_cache` und `open_oilfilter_search_cache` mit RLS an. Der Browser darf neue Referenzen nur über die eingeschränkte Suchfunktion anfordern und sie **nicht direkt in die Datenbank schreiben**.

## Sichere Datenintegration

Backend: **Supabase Free, Frankfurt** (RLS auf allen acht Katalogtabellen, Browser nur lesend). Frontend: **GitHub Pages**. Der Browser verwendet nur den öffentlichen Supabase-Publishable-Key, keinen Service-Role-Schlüssel.

Für spätere lizenzierte oder einzeln belegte Importdatensätze gibt es einen **standardmäßig schreibfreien Validator**:

```sh
node tools/import-reviewed-parts.cjs approved-records.json
```

Nur nach unabhängiger Quellenprüfung und Einrichten der geheimen Server-Umgebungsvariablen `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` kann mit `--apply` importiert werden. **Den Service-Role-Key niemals in den öffentlichen Repository-Code, die Browserkonsole, Screenshots oder Chats kopieren.** Die Datensätze müssen `reviewed: true`, eine konkrete Hersteller-/Lizenzquellen-URL, individuelle Motor-/Baujahrs- und Ausstattungsbedingungen und `source_type: "manufacturer_application"` oder `"licensed_feed"` enthalten. Der Importer akzeptiert bewusst keine Bilder oder Händlerpreise ohne eigenen Freigabeprozess.

Die optionalen Cloudflare/D1-Dateien unter `backend/` sind **nicht** produktiv. Der öffentliche CarParts-Katalog läuft über Supabase und enthält keine erfundenen OE-Nummern, Preise oder Passgarantien.


---

# CarParts — production catalog architecture

CarParts is no longer using fake product listings, fabricated prices or sample OE numbers. The website only displays actual catalog results from its API.

## Deployment

The frontend is hosted by GitHub Pages. **The currently deployed database is Supabase**. The Cloudflare Worker/D1 described below is an **uninstalled optional alternative architecture** — these deployment steps are not required for the current running CarParts site.

1. Create a Cloudflare account/project and install Wrangler (Node.js required): `npm install -g wrangler`.
2. Run `wrangler login`, then `wrangler d1 create carparts-catalog` inside `backend/`.
3. Copy the generated D1 database ID into `backend/wrangler.toml`.
4. Run `wrangler d1 execute carparts-catalog --remote --file=./schema.sql` inside `backend/`.
5. Create a strong import secret: `wrangler secret put IMPORT_TOKEN`.
6. Deploy from `backend/` with `wrangler deploy`.
7. In root `catalog-config.js`, set `baseUrl` to your Worker URL. Example: `https://carparts-api.<your-subdomain>.workers.dev/catalog`.
8. Set `ALLOWED_ORIGIN` to the public site origin in `backend/wrangler.toml` and redeploy.

**No product or vehicle rows are bundled.** The database starts empty and will show no results until you import legitimately sourced data.

## Real catalog ingestion

Obtain licensed product, OE, cross-reference and fitment records from a provider such as TecAlliance TecDoc Web Service, and current offers from suppliers. TecDoc's product and linkage feeds and supplier price/stock feeds are distinct integrations. The import endpoint accepts *normalized records from authorized data sources*; it does not claim to implement an unlicensed TecDoc connector.

`POST https://<worker>/admin/import`

Headers: `Authorization: Bearer <IMPORT_TOKEN>`, `Content-Type: application/json`.

Body fields are arrays: `vehicles`, `articles`, `oeNumbers`, `crossReferences`, `fitments`, `sellers`, `offers` (max 500 records per array per request).

Record shapes:

- `vehicles`: `{id,make,model,year,engineCode?,variant?}`
- `articles`: `{id,name,brand,articleNumber,category?,type?,isOem?}`
- `oeNumbers`: `{articleId,number,manufacturer?}`
- `crossReferences`: `{articleId,number,brand?}`
- `fitments`: `{articleId,vehicleId,engineCode?,variant?,qualification:"verified"|"unverified",notes?}`
- `sellers`: `{id,name,url?}`
- `offers`: `{articleId,sellerId,priceCents,currency?,inStock?}`

Import parent records (vehicles, articles, sellers) before child records (OE, cross refs, fitments, offers), or supply them together. IDs should come from a consistent, stable provider namespace. Mark fitment `verified` **only** when the source provides an explicit vehicle-to-article linkage for the exact variant; otherwise mark it `unverified`. A vehicle-profile completeness score is **not** proof that a part fits.

Search endpoint: `POST /catalog/search` with `{vehicle:{make,model,year,engine,variant,vin},query,mode}`. Returns `{results:[...]}`.

The frontend intentionally displays no parts when the backend is unconfigured, unavailable or empty. Prices are displayed only when imported from actual supplier offers.

## Next integration requirement

A licensed TecDoc Web Service subscription, or another legitimate automotive parts data source, plus actual supplier pricing feeds is still required for a populated catalog. Provider API keys must remain on the server; do not commit them to GitHub.

TecAlliance: https://www.tecalliance.net/products?solution=catalogue-ecommerce

