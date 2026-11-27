import {cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const [, , output, canonicalUrl] = process.argv;
if (!output) {
  throw new Error("Aufruf: node tools/prepare-ionos.mjs <Upload-Ordner> [https://example.com/]");
}

const canonical = canonicalUrl ? new URL(canonicalUrl) : null;
if (canonical && (canonical.protocol !== "https:" || !canonical.pathname.endsWith("/") ||
    canonical.search || canonical.hash || canonical.username || canonical.password)) {
  throw new Error("Die Website-URL muss eine HTTPS-Adresse mit abschließendem Schrägstrich sein.");
}

const target = resolve(output);
if (existsSync(target) && readdirSync(target).length) {
  throw new Error("Für den Export wird ein neuer oder leerer Ordner benötigt.");
}

const assets = [
  "index.html", "styles.css", "account.css", "account.js", "app.js", "catalog-config.js",
  "open-oilfilters.js", "open-oilfilters-data.js", "popular-models.js", "series-index.js",
  "smart-search-ui.js", "offer-comparison.js", "offer-comparison-ui.js", "supabase-catalog.js", "vehicle-series.js", "vin-check.js", "search-guide-ui.js",
  "supabase/functions/live-web-search/part-search.mjs",
  "supabase/functions/live-web-search/product-link.mjs",
  "supabase/functions/live-web-search/search-guide.mjs",
  "supabase/functions/live-web-search/catalogue.mjs",
  "supabase/functions/live-web-search/vehicle-fitment.mjs",
  "data"
];

for (const asset of assets) {
  const destination = join(target, asset);
  mkdirSync(dirname(destination), {recursive: true});
  cpSync(join(repository, asset), destination, {recursive: true, force: false, errorOnExist: true});
}

const legacyPages = readdirSync(repository).filter(name => /^carparts-v\d+\.html$/.test(name));
for (const page of legacyPages) {
  const html = readFileSync(join(repository, page), "utf8");
  const updated = html.replace(/(<link rel="canonical" href=")[^"]+/,
    (_, prefix) => prefix + (canonical?.href ?? "./"));
  writeFileSync(join(target, page), updated, {flag: "wx"});
}

cpSync(join(repository, "tools/ionos.htaccess"), join(target, ".htaccess"),
  {force: false, errorOnExist: true});
console.log(target);
