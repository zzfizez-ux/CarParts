// Usage: node tools/import-reviewed-parts.cjs records.json [--apply]
const {readFileSync} = require("node:fs");

const applicationFields = [
  "make", "model", "designation", "manufacturer", "part_name", "manufacturer_part_number", "category"
];
const batchSize = 250;

function requiredText(value, label, max = 240) {
  if (typeof value !== "string" || !value.trim() || value.trim() !== value || value.length > max) {
    throw Error(label + " muss ein nichtleerer Text sein");
  }
}

function httpsUrl(value, label) {
  requiredText(value, label, 1000);
  let url;
  try { url = new URL(value); } catch { throw Error(label + " ist keine gültige URL"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw Error(label + " muss eine HTTPS-Adresse sein");
  }
  return url;
}

function entries(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
    throw Error(label + " muss eine Liste von Datensätzen sein");
  }
  return value;
}

function productionYear(year) {
  return Number.isInteger(year) && year >= 1886 && year <= 2100;
}

function validate(records) {
  if (!Array.isArray(records) || !records.length) throw Error("Erwartet wird eine Liste geprüfter Anwendungen");
  const applications = new Set();
  for (const [index, row] of records.entries()) {
    try {
      for (const field of applicationFields) requiredText(row?.[field], field);
      if (row.designation.length > 160) throw Error("designation darf höchstens 160 Zeichen haben");
      if (row.engine_code != null) requiredText(row.engine_code, "engine_code", 80);
      if (row.reviewed !== true || !["manufacturer_application", "licensed_feed"].includes(row.source_type)) {
        throw Error("Eine geprüfte Herstelleranwendung oder ein lizenzierter Feed ist erforderlich");
      }
      if (row.source_type === "licensed_feed") requiredText(row.license_basis, "license_basis");
      httpsUrl(row.source_url, "source_url");
      if (row.article_url !== undefined) httpsUrl(row.article_url, "article_url");
      requiredText(row.fitment_notes, "fitment_notes", 1000);
      if (row.fitment_notes.length < 35) throw Error("fitment_notes muss die Anwendung genauer belegen");

      const engineStart = row.engine_year_from ?? row.year_from;
      const engineEnd = row.engine_year_to ?? row.year_to;
      if (![row.year_from, row.year_to, engineStart, engineEnd].every(productionYear) ||
          row.year_from > row.year_to || row.year_from < engineStart || row.year_to > engineEnd) {
        throw Error("Ungültiger Produktionszeitraum");
      }
      if (!Array.isArray(row.series_keys) || !row.series_keys.length ||
          row.series_keys.some(key => typeof key !== "string" || !/^[a-z0-9]+(?: [a-z0-9]+)*$/.test(key))) {
        throw Error("series_keys muss die CarParts-Baureihenschlüssel enthalten");
      }
      const application = JSON.stringify([
        row.make, row.model, row.designation, row.manufacturer, row.manufacturer_part_number
      ]);
      if (applications.has(application)) throw Error("Fahrzeuganwendung ist doppelt enthalten");
      applications.add(application);

      for (const oe of entries(row.oe_numbers, "oe_numbers")) {
        requiredText(oe.number, "OE-Nummer", 100);
        requiredText(oe.manufacturer, "OE-Marke");
        if (oe.source_url !== undefined) httpsUrl(oe.source_url, "OE-Quelle");
      }
      for (const image of entries(row.images, "images")) {
        httpsUrl(image.image_url, "Bildadresse");
        httpsUrl(image.source_url, "Bildquelle");
        requiredText(image.reuse_permission, "Bildfreigabe");
        requiredText(image.alt_text, "Bildbeschreibung");
        if (image.reuse_permission.length < 6) throw Error("Bitte die Bildfreigabe konkret angeben");
      }
      for (const offer of entries(row.offers, "offers")) {
        requiredText(offer.merchant_name, "Händlername");
        httpsUrl(offer.product_url, "Händlerprodukt");
        httpsUrl(offer.source_url, "Preisquelle");
        const observation = Date.parse(offer.observed_at);
        if (!Number.isFinite(offer.price_amount) || offer.price_amount <= 0 ||
            !/^[A-Z]{3}$/.test(offer.currency) || !Number.isFinite(observation) || observation > Date.now() + 300000) {
          throw Error("Ungültiger Händlerpreis, Währung oder Abrufzeitpunkt");
        }
      }
      if (["image_url", "price", "offer"].some(field => Object.hasOwn(row, field))) {
        throw Error("Bilder und Preise bitte als belegte Einträge in images oder offers angeben");
      }
    } catch (error) {
      throw Error("Zeile " + (index + 1) + " – " + error.message);
    }
  }
}

async function main() {
  const [file, option, ...rest] = process.argv.slice(2);
  if (!file || (option && option !== "--apply") || rest.length) {
    throw Error("Aufruf: node tools/import-reviewed-parts.cjs <Datei.json> [--apply]");
  }
  const records = JSON.parse(readFileSync(file, "utf8"));
  validate(records);
  console.log(records.length + " geprüfte Fahrzeuganwendungen validiert");
  if (option !== "--apply") return;

  const base = httpsUrl(process.env.SUPABASE_URL, "SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base.hostname !== "umhzxsryqhwzxrmkbmwp.supabase.co" || !key) {
    throw Error("Serverseitige Supabase-Zugangsdaten für CarParts erforderlich");
  }
  const endpoint = new URL("/rest/v1/rpc/import_catalogue_batch", base);
  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    const headers = {apikey: key, "Content-Type": "application/json"};
    if (!key.startsWith("sb_secret_")) headers.Authorization = "Bearer " + key;
    const response = await fetch(endpoint, {
      method: "POST", headers, body: JSON.stringify({records: batch}), signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw Error("Import ab Zeile " + (start + 1) + " fehlgeschlagen (HTTP " + response.status + ")" +
        (typeof detail.message === "string" ? " – " + detail.message : ""));
    }
    const result = await response.json();
    if (result.processed !== batch.length) throw Error("Unvollständige Bestätigung ab Zeile " + (start + 1));
    console.log((start + batch.length) + "/" + records.length + " Anwendungen in Supabase verarbeitet");
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
