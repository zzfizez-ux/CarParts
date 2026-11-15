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

