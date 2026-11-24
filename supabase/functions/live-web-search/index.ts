// Source-backed search. Price and fitment evidence come from their respective sources.
import {catalogueEngines, catalogueParts} from "./catalogue.mjs";
import {offersFromWeb, searchOffers} from "./offers.ts";
import type {Article, Vehicle} from "./offers.ts";
import {matchesPartText, seriesEvidence, words} from "./vehicle-fitment.mjs";
import {siteRequest} from "../_shared/site-config.mjs";
import {JsonBodyError, readJson} from "../_shared/read-json.mjs";
import {lookupRapidParts, rapidPartsForVehicle, rapidQuery} from "./rapid-parts.mjs";
import {createEbaySearch, externalSearches, lookupWeb, partsQuery, safeSourceUrl} from "./search-providers.mjs";
import {offerObservations} from "./offer-observations.mjs";

const searchEbay = createEbaySearch();
const publishableKeys = () => Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"));
const serviceKey = () => JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// Brief operational cache only; Brave results never enter the catalogue or persistent cache.
const transientResearch = new Map<string,{payload:any,expires:number}>();
const fields = new Set(["make","model","year","engine","series","variant","part","category"]);

async function database(table:string, filter:Record<string,string>, body?:unknown) {
  const key = serviceKey();
  if (!key) throw new Error("service_key");
  const url = new URL("/rest/v1/"+table,Deno.env.get("SUPABASE_URL") || "https://umhzxsryqhwzxrmkbmwp.supabase.co");
  url.search = new URLSearchParams(filter).toString();
  const response = await fetch(url,{
    method:body===undefined?"GET":"POST",
    headers:{apikey:key,"Content-Type":"application/json",Accept:"application/json",
      Prefer:"return=representation,resolution=merge-duplicates"},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(4000)
  });
  if (!response.ok) throw new Error(table+" "+response.status);
  if (response.status===204) return null;
  return await response.json();
}

function validText(value:unknown,max:number,required=false):value is string {
  return typeof value==="string" && value.length<=max && (!required||!!value.trim()) &&
    /^[\p{L}\p{N}\p{M} &'’.,+()#:/_–—-]*$/u.test(value) &&
    !/\b[A-HJ-NPR-Z0-9]{17}\b/i.test(value);
}

function normalize(value:string) {
  return value.normalize("NFKC").trim().replace(/\s+/g," ");
}

async function hashKey(parts:unknown[]) {
  const encoded = new TextEncoder().encode(JSON.stringify(parts).toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256",encoded);
  return Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function savedResearch(key:string) {
  const transient = transientResearch.get(key);
  if (transient && transient.expires>Date.now()) return {...transient.payload,status:"cached"};
  transientResearch.delete(key);
  const rows = await database("shared_parts_research",{
    select:"payload,checked_at",query_hash:"eq."+key,expires_at:"gt."+new Date().toISOString(),limit:"1"
  });
  return rows[0] ? {...rows[0].payload,status:"cached",fetched_at:rows[0].checked_at} : null;
}

async function saveResearch(key:string, payload:any, minutes:number, checked = new Date()) {
  if (payload.provider==="brave" && payload.results?.length) {
    if (transientResearch.size>=100) transientResearch.delete(transientResearch.keys().next().value!);
    transientResearch.set(key,{payload:{...payload,fetched_at:checked.toISOString()},expires:+checked+300000});
    return;
  }
  try {
    await database("shared_parts_research",{on_conflict:"query_hash"},[{
      query_hash:key,payload,checked_at:checked.toISOString(),
      expires_at:new Date(+checked+minutes*60000).toISOString()
    }]);
  } catch { console.warn("CarParts search cache write failed"); }
}

async function autoPartsFinder(vehicle:Vehicle, term:string, category:string) {
  const secret = Deno.env.get("RAPIDAPI_AUTO_PARTS_KEY");
  const query = rapidQuery(vehicle,term,category);
  if (!secret || !query) return {status:"skipped",parts:[]};
  try {
    const key = await hashKey(["auto-parts-finder-v1",vehicle.make,vehicle.series,query]);
    const stored = await savedResearch(key);
    if (stored && Array.isArray(stored.rapid_parts)) return {status:"cached",parts:stored.rapid_parts};
    const pauseKey = await hashKey(["auto-parts-finder-pause-v1"]);
    const paused = await savedResearch(pauseKey);
    if (paused) return {status:paused.rapid_status,parts:[]};
    const claim = await database("rpc/reserve_parts_rapidapi_lookup",{},{key_hash:key});
    if (claim!=="reserved") return {status:claim,parts:[]};

    const result = await lookupRapidParts(query,category,term,secret);
    if (result.status==="ready" || result.status==="empty") {
      await saveResearch(key,{rapid_parts:result.parts},result.parts.length?1440:60);
    } else {
      console.warn("Auto Parts Finder",result.status,result.http ?? "",result.reason ?? "");
      if (result.status==="access") {
        await database("rpc/mark_parts_rapidapi_access_denied",{},{key_hash:key})
          .catch(()=>console.warn("Auto Parts Finder allowance adjustment failed"));
      }
      if (result.status==="access" || result.status==="quota") {
        await saveResearch(pauseKey,{rapid_status:result.status},2);
      }
    }
    return result;
  } catch {
    console.warn("Auto Parts Finder could not load the private lookup state");
    return {status:"unavailable",parts:[]};
  }
}

async function manufacturerReferences(vehicle:Vehicle, category:string) {
  if (!category) return [];
  const rows = await database("research_part_candidates",{
    select:"manufacturer,manufacturer_part_number,part_name,source_vehicle_variant,fitment_conditions,source_url",
    make:"eq."+vehicle.make,model:"eq."+vehicle.model,category:"eq."+category,fitment_status:"eq.research_only",
    and:"(or(year_from.is.null,year_from.lte."+vehicle.year+"),or(year_to.is.null,year_to.gte."+vehicle.year+"))",
    order:"manufacturer.asc,manufacturer_part_number.asc",limit:"20"
  });
  return rows.filter((row:{source_vehicle_variant:string})=>seriesEvidence(vehicle,row.source_vehicle_variant)!=="conflict");
}

async function webResearch(key:string, vehicle:Vehicle, term:string, category:string) {
  const claim = await database("rpc/reserve_parts_web_lookup",{},{key_hash:key});
  if (claim!=="reserved") return {status:claim,provider:Deno.env.get("BRAVE_SEARCH_API_KEY") ? "brave" : "mwmbl",results:[]};
  const web = await lookupWeb(partsQuery(vehicle,term),Deno.env.get("BRAVE_SEARCH_API_KEY"));
  if (web.status!=="live") return web;
  try {
    const links = new Map();
    for (const row of web.results) {
      const link = typeof row?.url==="string" && safeSourceUrl(row.url);
      if (!link || typeof row.title!=="string" || links.has(link.href)) continue;
      const snippet = typeof row.content==="string" ? row.content.slice(0,140) : "";
      const description = [row.title,snippet,link.pathname].join(" ");
      const evidence = seriesEvidence(vehicle,description);
      const modelWord = words(vehicle.model);
      const text = words(description);
      if (!matchesPartText(description,term,category) || evidence==="conflict" ||
          (evidence!=="match" && !(" "+text+" ").includes(" "+modelWord+" "))) continue;
      links.set(link.href,{title:row.title.slice(0,140),snippet,url:link.href,merchant:link.hostname});
      if (links.size===8) break;
    }
    return {status:"live",provider:web.provider,results:[...links.values()]};
  } catch { return {status:"provider_error",provider:web.provider,results:[]}; }
}

async function research(vehicle:Vehicle, term:string, category:string, key:string) {
  const cached = await savedResearch(key);
  if (cached) return cached;
  const merchantClaim = await database("rpc/reserve_parts_merchant_lookup",{},{key_hash:key});
  if (merchantClaim==="busy") {
    for (const delay of [400,800,1500,2500]) {
      await new Promise(resolve=>setTimeout(resolve,delay));
      const hit = await savedResearch(key);
      if (hit) return hit;
    }
    return {status:"busy",products:[],references:[],results:[]};
  }

  // eBay shares the atomic merchant allowance (100 new searches/day). Cached searches are free.
  const ebayTask = merchantClaim==="reserved"
    ? searchEbay(vehicle,term,category,Deno.env.get("EBAY_CLIENT_ID"),Deno.env.get("EBAY_CLIENT_SECRET"))
    : Promise.resolve({status:merchantClaim,offers:[]});
  const [reviewed, catalogue] = await Promise.allSettled([
    manufacturerReferences(vehicle,category),
    catalogueEngines(database,vehicle).then(engines=>catalogueParts(database,engines,vehicle,term,category,true))
  ]);
  if (reviewed.status==="rejected" || catalogue.status==="rejected") {
    console.warn("CarParts source lookup unavailable", reviewed.status, catalogue.status);
  }
  const applications = catalogue.status==="fulfilled" ? catalogue.value : [];
  const foundParts = [...new Map(applications.map(p=>[p.id,p])).values()];
  const oldOffers = merchantClaim==="reserved" && foundParts.length ? await database("part_offers",{
    select:"part_id,product_url",part_id:"in.("+foundParts.map(p=>p.id).join(",")+")",
    verification_status:"eq.verified",limit:"40"
  }).catch(()=>[]) : [];
  const articles:Article[] = foundParts.map(row=>({
    part_id:row.id, manufacturer:row.manufacturer, manufacturer_part_number:row.manufacturer_part_number,
    source_url:row.fitment.source_url || row.source_url,
    condition:row.fitment.notes || row.engine,
    urls:oldOffers.filter((offer:{part_id:number})=>offer.part_id===row.id).map((offer:{product_url:string})=>offer.product_url)
  }));
  const conditional = foundParts.filter(p=>p.match==="conditional").map(p=>({
    manufacturer:p.manufacturer,manufacturer_part_number:p.manufacturer_part_number,part_name:p.part_name,
    source_vehicle_variant:p.engine,fitment_conditions:p.fitment.notes,source_url:p.fitment.source_url
  }));
  const references = [...conditional,...(reviewed.status==="fulfilled" ? reviewed.value : [])];
  const direct = merchantClaim==="reserved" ? await searchOffers(vehicle,term,category,articles)
    : {products:[],failures:[]};
  const rapidTask = direct.products.length || foundParts.some(part=>part.match==="exact")
    ? Promise.resolve({status:"skipped",parts:[]}) : autoPartsFinder(vehicle,term,category);
  const web = direct.products.length ? {status:"skipped",provider:"",results:[]} : await webResearch(key,vehicle,term,category);
  const fallback = merchantClaim==="reserved" && !direct.products.length && web.results.length
    ? await offersFromWeb(web.results,vehicle,term,category) : {products:[],failures:[]};
  const products = direct.products.length ? direct.products : fallback.products;
  const observations=offerObservations(products);
  if (observations.length) {
    await database("rpc/save_catalogue_offer_observations",{},{records:observations})
      .catch(()=>console.warn("CarParts merchant observations could not be stored"));
  }
  const [rapid, ebay] = await Promise.all([rapidTask,ebayTask]);
  const rapidParts = rapidPartsForVehicle(rapid.parts,vehicle,category,foundParts);
  const failures = [...direct.failures,...fallback.failures];
  for (const {merchant,reason} of failures) console.warn("CarParts merchant",merchant,reason);
  const payload = {
    products, marketplace_offers:ebay.offers, ebay_status:ebay.status,
    results:web.results, references, web_status:web.status,
    merchant_status:merchantClaim==="reserved"?(failures.length?"partial":"searched"):merchantClaim,
    merchant_failures:failures,
    rapid_parts:rapidParts, rapid_status:rapid.parts.length&&!rapidParts.length?"fitment_unconfirmed":rapid.status,
    provider:web.provider || (Deno.env.get("BRAVE_SEARCH_API_KEY") ? "brave" : "mwmbl"),
    license:Deno.env.get("BRAVE_SEARCH_API_KEY") ? "Brave Search API" : "CC BY-NC-SA 4.0"
  };
  const checked = new Date();
  const hasResults = products.length || ebay.offers.length || web.results.length || references.length || rapidParts.length;
  const rapidUnavailable = ["access","quota","cooldown","unavailable"].includes(rapid.status);
  const minutes = ebay.offers.length ? 15 : products.length ? 240 : rapidUnavailable ? 2 : hasResults ? 60
    : failures.length || web.status!=="live" ? 5 : 20;
  await saveResearch(key,payload,minutes,checked);
  return {...payload,status:hasResults?"live":"empty",fetched_at:checked.toISOString()};
}

Deno.serve(async (request:Request)=>{
  const {allowed, headers, json} = siteRequest(request, "content-type, apikey");
  if (!allowed) return json({error:"Origin not permitted"},403);
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers});
  if (request.method!=="POST") return json({error:"Method not allowed"},405);
  try {
    if (!publishableKeys().includes(request.headers.get("apikey")||"")) return json({error:"Invalid publishable key"},401);
    const p = await readJson(request,4000);
    if (!p || typeof p!=="object" || Array.isArray(p) || Object.keys(p).some(key=>!fields.has(key))) {
      return json({error:"Invalid input"},422);
    }
    if (!validText(p.make,90,true) || !validText(p.model,140,true) || !validText(p.part,80,true) ||
        !Number.isInteger(p.year) || p.year<1885 || p.year>new Date().getUTCFullYear()+1 ||
        !validText(p.engine??"",160) || !validText(p.series??"",160) ||
        !validText(p.variant??"",100) || !validText(p.category??"",80)) {
      return json({error:"Invalid vehicle/part"},422);
    }
    const vehicle = {
      make:normalize(p.make),model:normalize(p.model),series:normalize(p.series||""),
      year:p.year,engine:normalize(p.engine||""),variant:normalize(p.variant||"")
    };
    const term = normalize(p.part), category = normalize(p.category||"");
    const key = await hashKey(["products-v7",Boolean(Deno.env.get("BRAVE_SEARCH_API_KEY")),Boolean(Deno.env.get("EBAY_CLIENT_ID") && Deno.env.get("EBAY_CLIENT_SECRET")),vehicle,term,category]);
    return json({...await research(vehicle,term,category,key),external_searches:externalSearches(vehicle,term)});
  } catch (error) {
    if (error instanceof JsonBodyError) return json({error:error.message},error.status);
    console.error("CarParts research",error instanceof Error ? error.message : "unknown");
    return json({status:"error",products:[],results:[],references:[]},503);
  }
});
