# CarParts — free, source-backed replacement-part search

**Current architecture:** GitHub Pages frontend + Supabase Free (41 curated makes, 495 popular models, a small explicitly reviewed parts catalog). No paid catalog provider, hidden scraping, fabricated OE numbers, invented prices or asserted fitment guarantees.

## Manufacturer-backed catalog — initial limited coverage

CarParts first checks Supabase for **manufacturer-listed parts for the exact selected engine/hardware configuration**. The initial manual pilot has two factual manufacturer part-number entries for the **Volkswagen Golf VII (2012–2020), 2.0 TDI 150 PS (CRBC)**:

- **MANN-FILTER PU 8014** — diesel fuel filter, **only when the filter housing has a water sensor**. Source: https://www.mann-filter.com/de-de/katalog/suchergebnisse/produkt.html/pu8014_mann-filter.html
- **MANN-FILTER PU 8028** — diesel fuel filter, **only when the filter housing has no water sensor**. Source: https://www.mann-filter.com/de-de/katalog/suchergebnisse/produkt.html/pu8028_mann-filter.html

Those are two individually researched factual entries with direct manufacturer references, **not** a copied bulk product catalog. Before buying, a visitor must verify the exact vehicle generation, engine code, housing equipment, year/month and part number against the manufacturer or seller. A verified database link means the manufacturer lists it for the specified conditions, *not* a blanket compatibility guarantee.

### Test the limited example

1. Open the website and select **Volkswagen → Golf → 2018**.
2. Wait for additional manufacturer-listed engine variants to appear, then choose **Golf VII 2.0 TDI 150 PS (CRBC) – mit Wassersensor** or the **ohne Wassersensor** variant, as applicable.
3. Search for **Kraftstofffilter**. CarParts shows the corresponding real manufacturer's article number and the direct evidence link. The ordinary internet search remains below the evidence card.

All other engine choices are general suggestions, **not confirmed fitment matches**. Where the catalog has no exact verified match (or Supabase cannot be reached), the free external searches remain available; they are not certified fitment results. The database currently has no source-verified OE number, seller price or stock record; no such fields are fabricated.

### Supabase and safety

- Project is hosted in **eu-central-1** on the free plan. The connection uses `supabase-catalog.js` with a browser-safe **publishable API key only**. Never store a Supabase secret/service_role key in frontend files.
- All six public catalog tables use Row Level Security (RLS). Browser roles have read access only. Parts and fitments become visible through the public Data API only when their verification status is `verified`.
- `car_engines` is for narrowly documented configurations. An unqualified “2.0 TDI” selection does not imply that a particular filter fits.
- Adding further parts requires reviewable manufacturer's evidence and any needed permission for source reuse. Do not bulk scrape or copy proprietary catalogs.
- Repository `backend/` contains an optional Cloudflare/D1 architecture, not the currently deployed database.

## Development / limitations

Free web search links use Google, Bing, DuckDuckGo, eBay, and site-constrained results from automotive parts retailers. Links open external websites; CarParts does not automatically fetch live seller prices or check inventory. The NHTSA vPIC endpoint is used for VIN decoding, *not* to populate the curated make/model catalog.


---

# CarParts — production catalog architecture

CarParts is no longer using fake product listings, fabricated prices or sample OE numbers. The website only displays actual catalog results from its API.

## Deployment

The frontend is hosted by GitHub Pages. The backend is a Cloudflare Worker with a D1 SQL database.

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

