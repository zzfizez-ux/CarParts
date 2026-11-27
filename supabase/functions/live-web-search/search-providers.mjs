import {readJson} from "../_shared/read-json.mjs";
import {matchesPartText, seriesEvidence} from "./vehicle-fitment.mjs";

// Free text deliberately supports parts outside the small reference catalogue.
export function partsQuery(vehicle, term, max = 400) {
  // Catalogue engine labels can contain annotations for another component, e.g. a fuel-filter water sensor.
  // Keep the original vehicle for all evidence checks; only make the discovery query less repetitive.
  const engine=String(vehicle.engine||"").split(/\s+[–—]\s+|\s+-\s+/)[0];
  const series=String(vehicle.series||"");
  const model=series.toLocaleLowerCase().startsWith(String(vehicle.model||"").toLocaleLowerCase()+" ")?"":vehicle.model;
  return [term, vehicle.make, model, series, vehicle.year, engine, vehicle.variant]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function safeSourceUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch { return null; }
}

// Search-engine redirect/session links and eBay listings are not retailer sources in this flow.
export function researchSourceUrl(raw) {
  const url=safeSourceUrl(raw);
  if(!url || /(^|\.)(google|ebay)\.[a-z.]+$/i.test(url.hostname))return null;
  return url;
}

export function externalSearches(vehicle, term) {
  const query = partsQuery(vehicle, term, 200);
  const ebay = new URL("https://www.ebay.de/sch/i.html");
  ebay.search = new URLSearchParams({_nkw: query, _sacat: "131090"}).toString();
  return [{title: "Auf eBay nach diesem Teil suchen", url: ebay.href}];
}

const failureStatus = status => status === 429 ? "quota"
  : status === 401 || status === 403 ? "access" : "provider_error";

// Uses the existing, database-enforced web lookup allowance: one request per reservation.
export async function lookupWeb(phrase, braveKey, request = fetch) {
  const provider = braveKey ? "brave" : "mwmbl";
  const url = new URL(braveKey ? "https://api.search.brave.com/res/v1/web/search"
    : "https://api.mwmbl.org/api/v2/search/");
  url.searchParams.set("q", phrase);
  if (braveKey) {
    url.searchParams.set("country", "DE");
    url.searchParams.set("search_lang", "de");
    url.searchParams.set("count", "20");
  }
  try {
    const response = await request(url.href, {
      headers: {Accept: "application/json", ...(braveKey ? {"X-Subscription-Token": braveKey} : {})},
      redirect: "error", signal: AbortSignal.timeout(6500)
    });
    if (!response.ok) {
      await response.body?.cancel();
      return {status: failureStatus(response.status), provider, results: []};
    }
    const data = await readJson(response, 500000, {requireContentType: false});
    const rows = braveKey ? data.web?.results : data.results;
    if (!Array.isArray(rows)) return {status: "provider_error", provider, results: []};
    return {status: "live", provider, results: rows.slice(0, 20).map(row => ({
      url: row.url, title: row.title, content: braveKey ? row.description : row.content
    }))};
  } catch { return {status: "provider_error", provider, results: []}; }
}

export function ebayOffers(data, vehicle, term, category, checked = new Date()) {
  if (!Array.isArray(data?.itemSummaries)) {
    if (data?.total === 0) return [];
    throw new Error("Invalid eBay response");
  }
  const unique = new Map();
  for (const row of data.itemSummaries.slice(0, 50)) {
    const url = safeSourceUrl(row.itemWebUrl);
    const image = safeSourceUrl(row.image?.imageUrl);
    const price = typeof row.price?.value === "string" && /^\d+(?:\.\d{1,2})?$/.test(row.price.value)
      ? Number(row.price.value) : NaN;
    if (!url || !["www.ebay.de", "www.ebay.com", "www.ebay.co.uk"].includes(url.hostname) ||
        !/^\/itm\//.test(url.pathname) || typeof row.title !== "string" ||
        !Number.isFinite(price) || price <= 0 || row.price.currency !== "EUR" ||
        !matchesPartText(row.title, term, category) || seriesEvidence(vehicle, row.title) === "conflict") continue;
    if (image && image.hostname !== "i.ebayimg.com") continue;
    if (unique.has(url.href)) continue;
    unique.set(url.href, {
      name: row.title.slice(0, 200), price, currency: "EUR", image: image?.href || "", url: url.href,
      merchant: "eBay", sku: "", source_url: "", evidence: "listing_only", fitment_status: "unconfirmed",
      condition: [row.condition, "Fahrzeugzuordnung beim Verkäufer prüfen; keine bestätigte Passform."].filter(Boolean).join(" · "),
      observed_at: checked.toISOString()
    });
    if (unique.size === 12) break;
  }
  return [...unique.values()];
}

// A short-lived application token is kept server-side and renewed automatically.
export function createEbaySearch(request = fetch) {
  let token = "", expiry = 0, credentials = "", pending;
  async function accessToken(clientId, clientSecret) {
    const identity = clientId + ":" + clientSecret;
    if (credentials !== identity) { token = ""; expiry = 0; credentials = identity; }
    if (token && expiry > Date.now() + 60000) return token;
    if (!pending) pending = (async () => {
      const response = await request("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(identity)},
        body: new URLSearchParams({grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope"}).toString(),
        redirect: "error", signal: AbortSignal.timeout(6500)
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(failureStatus(response.status)); }
      const data = await readJson(response, 30000);
      if (typeof data.access_token !== "string" || !Number.isFinite(data.expires_in) || data.expires_in <= 60)
        throw new Error("provider_error");
      token = data.access_token; expiry = Date.now() + data.expires_in * 1000;
      return token;
    })().finally(() => { pending = undefined; });
    return pending;
  }
  return async function search(vehicle, term, category, clientId, clientSecret) {
    if (!clientId || !clientSecret) return {status: "not_configured", offers: []};
    try {
      const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
      url.search = new URLSearchParams({q: partsQuery(vehicle, term, 100), limit: "50",
        category_ids: "131090", filter: "deliveryCountry:DE,priceCurrency:EUR"}).toString();
      for (let attempt = 0; attempt < 2; attempt++) {
        const access = await accessToken(clientId, clientSecret);
        const response = await request(url.href, {headers: {Authorization: "Bearer " + access,
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_DE", "Accept-Language": "de-DE", Accept: "application/json"},
          redirect: "error", signal: AbortSignal.timeout(6500)});
        if (response.status === 401 && attempt === 0) {
          await response.body?.cancel(); token = ""; expiry = 0; continue;
        }
        if (!response.ok) {
          await response.body?.cancel(); return {status: failureStatus(response.status), offers: []};
        }
        const offers = ebayOffers(await readJson(response, 500000), vehicle, term, category);
        return {status: offers.length ? "live" : "empty", offers};
      }
    } catch (error) {
      return {status: ["access", "quota"].includes(error?.message) ? error.message : "provider_error", offers: []};
    }
    return {status: "access", offers: []};
  };
}

// Serper uses prepaid credits and offers a card-free trial. One standard web request per reservation.
export async function lookupSerper(phrase, key, request = fetch) {
  if (!key) return {status:"not_configured",provider:"none",results:[]};
  try {
    const response=await request("https://google.serper.dev/search",{
      method:"POST",headers:{"X-API-KEY":key,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({q:phrase,gl:"de",hl:"de",num:10}),
      redirect:"error",signal:AbortSignal.timeout(6500)
    });
    if(!response.ok){await response.body?.cancel();return {status:failureStatus(response.status===402?429:response.status),provider:"serper",results:[]};}
    const data=await readJson(response,500000,{requireContentType:false});
    if(!Array.isArray(data.organic))return {status:"provider_error",provider:"serper",results:[]};
    return {status:"live",provider:"serper",results:data.organic.slice(0,10).map(row=>({url:row.link,title:row.title,content:row.snippet}))};
  }catch{return {status:"provider_error",provider:"serper",results:[]};}
}
