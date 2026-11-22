import {parseHTML} from "npm:linkedom@0.18.12";
import {hasPartNumber, matchesPartText, matchesPosition, partNumber, seriesEvidence, words} from "./vehicle-fitment.mjs";

const frankfurt = "shop.autoersatzteile-frankfurt.de";
const kunzmann = "www.kunzmann.de";
const stores: Record<string,string> = {
  [frankfurt]:"Autoersatzteile Frankfurt", [kunzmann]:"Autohaus Kunzmann",
  "levoil.de":"levoil", "www.autodoc.de":"AUTODOC", "www.atp-autoteile.de":"ATP Autoteile",
  "www.kfzteile24.de":"kfzteile24", "www.kfzparts24.de":"KfzParts24",
  "www.motointegrator.de":"Motointegrator", "www.autoteiledirekt.de":"Autoteile Direkt",
  "www.pkwteile.de":"PKWteile", "www.mister-auto.de":"Mister-Auto", "www.daparto.de":"Daparto"
};
const articlePages: Record<string,string[]> = {
  HU7020Z:[
    "https://levoil.de/produkt/mann-filter-oelfilter-hu-7020-z-passend-fuer-vw-golf-7-passat-b8-audi-a3-skoda-octavia-1-6-2-0-tdi/",
    "https://www.autodoc.de/mann-filter/7624418"
  ],
  HU6004X:["https://levoil.de/produkt/mann-filter-oelfilter-hu-6004-x-passend-fuer-bmw-1er-f20-3er-e90-f30-5er-f10-x1-x3-x5-diesel-n47-n57/"],
  HU60141Z:["https://levoil.de/produkt/mann-filter-oelfilter-hu-6014-1-z-passend-fuer-bmw-3er-g20-f30-5er-g30-x3-g01-1er-f20-b47-b48-b57-b58/"],
  W71294:["https://www.atp-autoteile.de/de/product/986309-mann-filter-oelfilter"],
  PU8014:["https://www.autodoc.de/mann-filter/11928707"]
};
const s63Discs = [
  "https://"+frankfurt+"/BREMBO-Bremsscheibe-VORNE-MERCEDES-BENZ-S-KLASSE-W222-A217-C217-AMG",
  "https://"+kunzmann+"/shop/de-de/p/s63-s65-amg-bremsscheiben-satz-vorne-s-klasse-w222-original-mercedes-benz-33967.htm"
];

export type Vehicle = {make:string; model:string; series:string; engine:string; year:number; variant:string};
export type Article = {
  manufacturer:string; manufacturer_part_number:string; condition:string;
  source_url:string; urls:string[];
};
type Page = {url:string; article?:Article; reviewed222?:boolean};
type SourceFailure = {merchant:string; reason:string};
type Product = {
  name:string; price:number; currency:string; image:string; url:string; merchant:string;
  sku:string; condition:string; source_url:string; evidence:string; observed_at:string
};

function httpsUrl(raw:string, base?:string) {
  try {
    const url = new URL(raw,base);
    return raw && url.protocol==="https:" && !url.port && !url.username && !url.password ? url : null;
  } catch { return null; }
}

export function merchantUrl(raw:string, base?:string) {
  const url = httpsUrl(raw,base);
  if (!url || !Object.hasOwn(stores,url.hostname)) return null;
  url.hash = "";
  return url;
}

async function shopPage(input:string) {
  let url = merchantUrl(input);
  const signal = AbortSignal.timeout(4500);
  for (let hop=0; url && hop<=2; hop++) {
    const response = await fetch(url, {redirect:"manual", signal, headers:{Accept:"text/html"}});
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      url = merchantUrl(response.headers.get("location")||"",url.href);
      continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      throw new Error("http_"+response.status);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("missing_page");
    const decoder = new TextDecoder();
    let html="", size=0;
    try {
      for (;;) {
        const {value,done} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2500000) {
          await reader.cancel();
          throw new Error("page_size");
        }
        html += decoder.decode(value,{stream:true});
      }
    } finally { reader.releaseLock(); }
    return {doc:parseHTML(html+decoder.decode()).document,url};
  }
  throw new Error("redirect");
}

function is222Search(vehicle:Vehicle, term:string, category:string) {
  const model = words(vehicle.model);
  const series = words(vehicle.series);
  const engine = words(vehicle.engine);
  const variant = words(vehicle.variant);
  const amgFacelift = words(vehicle.make)==="mercedes amg" && model==="s class" &&
    series==="s class 2017" && vehicle.year>=2017 && /\b612 (hp|ps)\b/.test(engine);
  const sedan222 = /^(w|v) ?222$/.test(series);
  return ["mercedes benz","mercedes amg"].includes(words(vehicle.make)) &&
    ["s klasse","s class"].includes(model) && (sedan222 || amgFacelift) &&
    /\bs ?6[35]\b|\b612 (hp|ps)\b/.test(engine) && vehicle.year>=2013 && vehicle.year<=2020 &&
    !/\b(coupe|cabrio|cabriolet|keramik|ceramic|w221|w223|c217|a217)\b/.test(variant+" "+words(term)) &&
    (matchesPartText("Bremsscheiben vorne Vorderachse brake discs front",term,category) ||
      partNumber(term)==="A2224212612");
}

function metadata(doc:ReturnType<typeof parseHTML>["document"], key:string) {
  const value = doc.querySelector('meta[property="'+key+'"],meta[name="'+key+'"],[itemprop="'+key+'"][content]');
  return value?.getAttribute("content") || "";
}

function parsePrice(value:unknown) {
  const raw = String(value ?? "").trim().replace(/[\s\u00a0]/g,"");
  if (/^\d+(\.\d{1,2})?$/.test(raw)) return Number(raw);
  if (/^\d+(\.\d{3})*(,\d{1,2})?$/.test(raw)) return Number(raw.replaceAll(".","").replace(",","."));
  return NaN;
}

async function product(source:Page, vehicle:Vehicle, term:string, category:string):Promise<Product|null> {
  const {doc,url} = await shopPage(source.url);
  const nodes = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      for (const item of [JSON.parse(script.textContent||"null")].flat()) {
        if (item && typeof item==="object") {
          nodes.push(item);
          if (Array.isArray(item["@graph"])) nodes.push(...item["@graph"]);
        }
      }
    } catch { /* Other metadata on the page may still contain the product. */ }
  }
  const item = nodes.find(node => node && [node["@type"]].flat().some(t => t==="Product" || t==="https://schema.org/Product"));
  const offer = [item?.offers].flat().find(value => value?.price != null);
  const price = parsePrice(offer?.price ?? (metadata(doc,"product:price:amount") || metadata(doc,"price")));
  const currency = String(offer?.priceCurrency || metadata(doc,"product:price:currency") || metadata(doc,"priceCurrency"));
  const image = [item?.image].flat()[0];
  const imageRaw = (typeof image==="string" ? image : image?.url || image?.contentUrl) || metadata(doc,"og:image");
  const photo = typeof imageRaw==="string" ? httpsUrl(imageRaw,url.href) : null;
  const name = String(item?.name || doc.querySelector("h1")?.textContent || "").trim();
  if (!name || (!Number.isFinite(price) || price<=0) || currency!=="EUR" || !photo) throw new Error("product_metadata");

  const sku = String(item?.mpn || item?.sku || metadata(doc,"mpn") || metadata(doc,"sku") || "");
  const identity = [name,sku,decodeURI(url.pathname)].join(" ");
  const evidence = seriesEvidence(vehicle,identity);
  if (evidence==="conflict" || !matchesPosition(term,name)) return null;
  const article = source.article;
  if (article) {
    if (!hasPartNumber(identity,article.manufacturer_part_number)) return null;
    // A retailer may use a different SKU. The manufacturer and article number must still agree.
    const brand = words(article.manufacturer);
    const listedBrand = words(typeof item?.brand==="string" ? item.brand : item?.brand?.name);
    if (!(words(name).includes(brand) || listedBrand===brand)) return null;
  } else if (source.reviewed222) {
    if (!/\b(w222|v222)\b/.test(words(identity))) return null;
  } else {
    if (evidence!=="match" || !matchesPartText(name,term,category)) return null;
    // Safety-relevant products need a reviewed application or explicit sourced vehicle mapping.
    if (/brems|brake|querlenker|lenkung|spurstang|airbag/.test(words([term,category,name].join(" ")))) return null;
  }

  const condition = article?.condition || (source.reviewed222
    ? "Händlerzuordnung für die Vorderachse der Baureihe 222. Bremssystem und OE-Nummer am Fahrzeug abgleichen."
    : "Baureihe laut Händlerangebot. Motor, Ausstattung und OE-Nummer am Fahrzeug abgleichen.");
  return {
    name:name.slice(0,200), price, currency, image:photo.href, url:url.href, merchant:stores[url.hostname],
    sku:(article?.manufacturer_part_number || sku).slice(0,90), condition,
    source_url:article?.source_url||"", evidence:article ? "manufacturer" : "merchant",
    observed_at:new Date().toISOString()
  };
}

async function findPages(input:string, article:Article|undefined, vehicle:Vehicle, term:string, category:string) {
  const {doc,url} = await shopPage(input);
  const pages:Page[] = [];
  const links = doc.querySelectorAll('.productbox a[href], .product-wrapper a[href], a.woocommerce-LoopProduct-link[href], a.woocommerce-loop-product__link[href]');
  for (const link of links) {
    const target = merchantUrl(link.getAttribute("href")||"",url.href);
    if (!target || target.hostname!==url.hostname || target.search || target.pathname==="/" ||
        pages.some(page=>page.url===target.href)) continue;
    const text = decodeURI(target.pathname)+" "+link.textContent;
    const relevant = article ? hasPartNumber(text,article.manufacturer_part_number)
      : seriesEvidence(vehicle,text)==="match" && matchesPartText(text,term,category);
    if (relevant) pages.push({url:target.href,article});
    if (pages.length===2) break;
  }
  return pages;
}

function recordFailure(failures:SourceFailure[], url:string, error:unknown) {
  const merchant = merchantUrl(url)?.hostname;
  if (!merchant) return;
  const message = error instanceof Error ? error.message : "";
  const reason = ["missing_page","page_size","redirect","product_metadata"].includes(message) || /^http_\d{3}$/.test(message)
    ? message : error instanceof Error && error.name==="TimeoutError" ? "timeout" : "unreachable";
  if (!failures.some(f=>f.merchant===merchant && f.reason===reason)) failures.push({merchant,reason});
}

export async function searchOffers(vehicle:Vehicle, term:string, category:string, articles:Article[]) {
  const pages:Page[] = is222Search(vehicle,term,category) ? s63Discs.map(url=>({url,reviewed222:true})) : [];
  const failures:SourceFailure[] = [];
  for (const article of articles.slice(0,3)) {
    for (const url of [...article.urls, ...(articlePages[partNumber(article.manufacturer_part_number)]||[])]) {
      if (merchantUrl(url) && !pages.some(page=>page.url===url)) pages.push({url,article});
    }
  }
  const fetchProducts = (sources:Page[]) => Promise.all(sources.slice(0,5).map(async source => {
    try { return await product(source,vehicle,term,category); }
    catch(error) { recordFailure(failures,source.url,error); return null; }
  })).then(rows => rows.filter((row):row is Product=>row!==null));

  let products = await fetchProducts(pages);
  if (!products.length) {
    const article = articles[0];
    const needle = article?.manufacturer_part_number || [term,vehicle.make,vehicle.model,vehicle.series].filter(Boolean).join(" ");
    const query = encodeURIComponent(needle);
    const searchPages = [
      "https://"+frankfurt+"/?qs="+query,
      "https://levoil.de/?s="+query+"&post_type=product"
    ];
    const discovered = await Promise.all(searchPages.map(async url => {
      try { return await findPages(url,article,vehicle,term,category); }
      catch(error) { recordFailure(failures,url,error); return []; }
    }));
    const eligible = [...new Map(discovered.flat().map(page=>[page.url,page])).values()];
    products = await fetchProducts(eligible.filter(page=>!pages.some(previous=>previous.url===page.url)));
  }
  return {products:[...new Map(products.map(item=>[item.url,item])).values()].sort((a,b)=>a.price-b.price),failures};
}

export async function offersFromWeb(hits:{url:string}[], vehicle:Vehicle, term:string, category:string) {
  const failures:SourceFailure[] = [];
  const sources = hits.filter(hit=>merchantUrl(hit.url)).slice(0,3);
  const rows = await Promise.all(sources.map(async hit=>{
    try { return await product(hit,vehicle,term,category); }
    catch(error) { recordFailure(failures,hit.url,error); return null; }
  }));
  return {products:rows.filter((row):row is Product=>row!==null).sort((a,b)=>a.price-b.price),failures};
}
