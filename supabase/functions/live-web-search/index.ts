// Source-backed search. Price and fitment evidence come from their respective sources.
import {catalogueEngines, catalogueParts} from "./catalogue.mjs";
import {offersFromWeb, searchOffers} from "./offers.ts";
import type {Article, Vehicle} from "./offers.ts";
import {hasPartNumber, matchesPartText, seriesEvidence, words} from "./vehicle-fitment.mjs";
import {siteRequest} from "../_shared/site-config.mjs";
import {JsonBodyError, readJson} from "../_shared/read-json.mjs";
import {conflictsWithApplications, effectiveVehicle, filterApplications, filterProducts, matchesRequestedReference, searchPlan, searchTerm, validateSearchDetails} from "./search-guide.mjs";
import {lookupSerper, partsQuery, researchSourceUrl} from "./search-providers.mjs";
import {understandPartQuery} from "./part-search.mjs";
import {lookupShopping} from "./search-providers.mjs";
import {shoppingProducts,shoppingQuery,combineProducts} from "./shopping-products.mjs";
import {offerObservations} from "./offer-observations.mjs";

const publishableKeys = () => Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"));
const serviceKey = () => JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
// Bounded comparison snapshots retain source attribution; they are separate from the verified parts catalogue.
const fields = new Set(["make","model","year","engine","series","variant","part","category","details","literal"]);

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
  const rows = await database("shared_parts_research",{
    select:"payload,checked_at",query_hash:"eq."+key,expires_at:"gt."+new Date().toISOString(),limit:"1"
  });
  return rows[0] ? {...rows[0].payload,status:"cached",fetched_at:rows[0].checked_at} : null;
}

async function saveResearch(key:string, payload:any, minutes:number, checked = new Date()) {

  try {
    await database("shared_parts_research",{on_conflict:"query_hash"},[{
      query_hash:key,payload,checked_at:checked.toISOString(),
      expires_at:new Date(+checked+minutes*60000).toISOString()
    }]);
  } catch { console.warn("CarParts search cache write failed"); }
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

async function webResearch(key:string, vehicle:Vehicle, term:string, category:string, details:any, applications:any[], excluded:any[]) {
  if(!Deno.env.get("SERPER_API_KEY")) return {status:"not_configured",provider:"none",results:[]};
  const claim = await database("rpc/reserve_parts_web_lookup",{},{key_hash:key});
  if (claim!=="reserved") return {status:claim,provider:Deno.env.get("SERPER_API_KEY") ? "serper" : "none",results:[]};
  const reference=details.oe_number || applications[0]?.manufacturer_part_number;
  const phrase=reference
    ? [term,reference,applications[0]?.manufacturer,vehicle.make,vehicle.model].filter(Boolean).join(" ")
    : partsQuery(vehicle,term);
  const web = await lookupSerper(phrase+" Ersatzteil kaufen -site:ebay.de -site:ebay.com",Deno.env.get("SERPER_API_KEY"));
  if (web.status!=="live") return web;
  try {
    const links = new Map();
    for (const row of web.results) {
      const link = typeof row?.url==="string" && researchSourceUrl(row.url);
      if (!link || typeof row.title!=="string" || links.has(link.href)) continue;
      const snippet = typeof row.content==="string" ? row.content.slice(0,140) : "";
      const description = [row.title,snippet,link.pathname].join(" ");
      if(conflictsWithApplications(description,excluded))continue;
      const evidence = seriesEvidence(vehicle,description);
      const knownReference=applications.some(part=>hasPartNumber(description,part.manufacturer_part_number));
      const modelWord = words(vehicle.model);
      const text = words(description);
      if (!matchesRequestedReference(description,details.oe_number,applications) || (!knownReference && !matchesPartText(description,term,category)) || evidence==="conflict" ||
          (evidence!=="match" && !knownReference && !(" "+text+" ").includes(" "+modelWord+" "))) continue;
      links.set(link.href,{title:row.title.slice(0,140),snippet,url:link.href,merchant:link.hostname});
      if (links.size===8) break;
    }
    return {status:"live",provider:web.provider,results:[...links.values()]};
  } catch { return {status:"provider_error",provider:web.provider,results:[]}; }
}

async function research(vehicle:Vehicle, term:string, category:string, key:string, details:any) {
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

  const engines = await catalogueEngines(database,vehicle).catch(()=>[]);
  const [reviewed, catalogue] = await Promise.allSettled([
    manufacturerReferences(vehicle,category),
    catalogueParts(database,engines,vehicle,term,category,true)
  ]);
  if (reviewed.status==="rejected" || catalogue.status==="rejected") {
    console.warn("CarParts source lookup unavailable", reviewed.status, catalogue.status);
  }
  const applications = catalogue.status==="fulfilled" ? catalogue.value : [];
  const foundParts = [...new Map(filterApplications(applications,vehicle,term,details).map(p=>[p.id,p])).values()];
  const excluded=applications.filter(part=>!foundParts.some(accepted=>accepted.id===part.id));
  const plan = searchPlan(vehicle,term,category,details,engines,applications);
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
  let shopping:any={status:"not_configured",provider:"none",results:[]};
  if(Deno.env.get("SERPER_API_KEY")){
   const shoppingKey=await hashKey([key,"shopping"]);
   const claim=await database("rpc/reserve_parts_web_lookup",{},{key_hash:shoppingKey});
   shopping=claim==="reserved"?await lookupShopping(shoppingQuery(vehicle,term,foundParts,details),Deno.env.get("SERPER_API_KEY")):{status:claim,provider:"serper",results:[]};
  }
  const market=filterProducts(shoppingProducts(shopping.results,vehicle,term,category,foundParts,details),foundParts,term,details,excluded);
  const hasComplete=[...direct.products,...market].some(product=>product.price!==null && product.image);
  const web = hasComplete ? {status:"skipped",provider:"",results:[]} : await webResearch(key,vehicle,term,category,details,foundParts,excluded);
  const fallback = merchantClaim==="reserved" && !hasComplete && web.results.length
    ? await offersFromWeb(web.results,vehicle,term,category,articles) : {products:[],failures:[]};
  const products = filterProducts(combineProducts([...market,...direct.products,...fallback.products]),foundParts,term,details,excluded).map(product=>({
    ...product,fitment_status:product.reference_part_id&&["application_found","reference_match"].includes(foundParts.find(part=>part.id===product.reference_part_id)?.assessment.status)
      ?"cross_reference_found":foundParts.find(part=>part.id===(product.part_id||product.reference_part_id))?.assessment.status || "unconfirmed",
    fitment_conflicts:foundParts.find(part=>part.id===(product.part_id||product.reference_part_id))?.assessment.conflicts || [],
    fitment_unresolved:foundParts.find(part=>part.id===(product.part_id||product.reference_part_id))?.assessment.unresolved || []
  }));
  const observations=offerObservations(products);
  if (observations.length) {
    await database("rpc/save_catalogue_offer_observations",{},{records:observations})
      .catch(()=>console.warn("CarParts merchant observations could not be stored"));
  }
  const failures = [...direct.failures,...fallback.failures];
  for (const {merchant,reason} of failures) console.warn("CarParts merchant",merchant,reason);
  const payload = {
    products, search_plan:plan, shopping_status:shopping.status,
    results:web.results, references, web_status:web.status,
    merchant_status:merchantClaim==="reserved"?(failures.length?"partial":"searched"):merchantClaim,
    merchant_failures:failures,
    provider:web.provider || (Deno.env.get("SERPER_API_KEY") ? "serper" : "none"),
    license:Deno.env.get("SERPER_API_KEY") ? "Serper Search API" : "Hersteller- und Händlerquellen"
  };
  const checked = new Date();
  const hasResults = products.length || web.results.length || references.length;
  const minutes = products.length ? 60 : hasResults ? 30
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
        !validText(p.variant??"",100) || !validText(p.category??"",80) ||
        (p.literal!==undefined && typeof p.literal!=="boolean")) {
      return json({error:"Invalid vehicle/part"},422);
    }
    let details;
    try { details = validateSearchDetails(p.details); } catch { return json({error:"Ungültige Zusatzangaben. Bitte Eingaben prüfen."},422); }
    const vehicle = effectiveVehicle({
      make:normalize(p.make),model:normalize(p.model),series:normalize(p.series||""),
      year:p.year,engine:normalize(p.engine||""),variant:normalize(p.variant||"")
    },details);
    let term;
    try {term=searchTerm(normalize(p.part),details);}catch(error){return json({error:(error as Error).message},422);}
    const understanding=understandPartQuery(term,{literal:p.literal===true});
    if(understanding.status==="ambiguous")return json({status:"needs_clarification",understanding,products:[],results:[],references:[],provider:"none"});
    term=understanding.query;
    const category=p.literal ? "" : understanding.category || (understanding.status==="identifier"?normalize(p.category||""):"");
    const key = await hashKey(["complete-offers-v4",Boolean(Deno.env.get("SERPER_API_KEY")),vehicle,term,category,details,p.literal===true]);
    return json({...await research(vehicle,term,category,key,details),understanding});
  } catch (error) {
    if (error instanceof JsonBodyError) return json({error:error.message},error.status);
    console.error("CarParts research",error instanceof Error ? error.message : "unknown");
    return json({status:"error",products:[],results:[],references:[]},503);
  }
});
