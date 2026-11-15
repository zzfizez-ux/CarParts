# CarParts

AI-assisted vehicle parts finder.

## What is live now

- Dark/light mode with dark-mode-safe button surfaces.
- Searchable vehicle **Brand + Model** selection.
- Brand list is pre-populated immediately and then enriched from NHTSA vPIC.
- Models are loaded dynamically for the selected brand and, when available, model year.
- VIN decoding uses NHTSA vPIC.
- Fitment readiness is shown instead of pretending an uncertain match is exact.
- The frontend has a normalized **live parts catalog adapter** for OE numbers, aftermarket references, vehicle fitment, price, supplier and availability.

NHTSA's public vPIC service is a vehicle-information source, not a complete aftermarket parts catalogue. Its API documents make/model/model-year workflows and VIN decoding.

## Real parts data

For a production European parts catalogue, the intended provider is **TecAlliance / TecDoc**. TecDoc currently advertises 1,200+ brands, 12.8M article records and 724M vehicle linkages, with search by VIN, part number and OE number, vehicle-to-part matching, OE data and cross-reference data.

Supplier pricing/availability is a separate layer: TecAlliance documents supplier comparison, real-time pricing/stock through connected ERP/TecCom integrations, and structured supplier article/price/availability data.

**Important:** TecDoc data is licensed. Do not scrape or copy its catalogue into this repository without the appropriate agreement. Cross-reference usage is also governed by the applicable TecAlliance contract.

## Connect the live catalog

GitHub Pages is static hosting and does not run server-side PHP/Ruby/Python. Keep provider credentials on a backend, never in `app.js` or `catalog-config.js`.

Set:

```js
window.CARPARTS_CATALOG_CONFIG = {
  baseUrl: "https://YOUR-SECURE-BACKEND.example.com/catalog",
  provider: "TecDoc",
  timeoutMs: 12000
};
```

Your backend should expose:

`POST /search`

Request:

```json
{
  "vehicle": {
    "make": "Audi",
    "model": "A4",
    "year": "2020",
    "engine": "…",
    "variant": "…",
    "vin": "…"
  },
  "query": "front brake pads",
  "mode": "value"
}
```

Return normalized results:

```json
{
  "results": [
    {
      "name": "…",
      "brand": "…",
      "articleNumber": "…",
      "oeNumbers": ["…"],
      "crossReferences": ["…"],
      "fitment": {
        "status": "confirmed",
        "score": 100,
        "reason": "Explicit vehicle-to-part linkage from provider"
      },
      "price": 0,
      "currency": "EUR",
      "priceIncludesVat": true,
      "seller": "…",
      "availability": "in stock",
      "url": "…"
    }
  ]
}
```

The UI only labels a result as an exact fit when the connected provider explicitly returns confirmed/exact fitment or a score of at least 90. Otherwise it shows a warning.

## Why there is no fake "real database" in the repo

A real OE/aftermarket/fitment/price/dealer database is not something that can be truthfully generated from scratch inside a static website. It requires licensed catalogue data and live supplier feeds. TecDoc is a suitable production source for the catalogue/fitment layer; supplier/ERP feeds are needed for current price and stock.



## Current limitation

The repository intentionally does **not** pretend that its bundled demo parts are a live commercial catalogue. The live adapter is ready, but a real OE/aftermarket/fitment/price/dealer feed must be connected through a licensed provider and a secure backend. GitHub Pages itself only hosts static files, so provider secrets must stay server-side.
