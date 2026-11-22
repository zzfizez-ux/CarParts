// Source-backed search. Price and fitment evidence come from their respective sources.
import {catalogueEngines, catalogueParts} from "./catalogue.mjs";
import {merchantUrl, offersFromWeb, searchOffers} from "./offers.ts";
import type {Article, Vehicle} from "./offers.ts";
import {matchesPartText, seriesEvidence, words} from "./vehicle-fitment.mjs";

const origin = "https://zzfizez-ux.github.io";
const headers = {
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "Access-Control-Allow-Origin":origin,
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Access-Control-Allow-Headers":"content-type,apikey",
  Vary:"Origin"
};
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status});
const publishableKeys = () => Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"));
const serviceKey = () => JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

async function searchKey(vehicle:Vehicle, term:string, category:string) {
  const encoded = new TextEncoder().encode(JSON.stringify(["products-v3",vehicle,term,category]).toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256",encoded);
  return Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function savedResearch(key:string) {
  const rows = await database("shared_parts_research",{
    select:"payload,checked_at",query_hash:"eq."+key,expires_at:"gt."+new Date().toISOString(),limit:"1"
  });
  return rows[0] ? {...rows[0].payload,status:"cached",fetched_at:rows[0].checked_at} : null;
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
  if (claim!=="reserved") return {status:claim,results:[]};
  const phrase = [vehicle.make,vehicle.model,vehicle.series,vehicle.year,vehicle.engine,vehicle.variant,term]
    .filter(Boolean).join(" ");
  const provider = "https://api.mwmbl.org/api/v2/search/?q="+encodeURIComponent(phrase);
  try {
    const response = await fetch(provider,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(6500)});
    if (!response.ok) return {status:response.status===429?"quota":"provider_error",results:[]};
    const data = await response.json();
    if (!Array.isArray(data.results)) return {status:"provider_error",results:[]};
    const links = new Map();
    for (const row of data.results) {
      const link = typeof row?.url==="string" && merchantUrl(row.url);
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
    return {status:"live",results:[...links.values()]};
  } catch { return {status:"provider_error",results:[]}; }
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
    manufacturer:row.manufacturer, manufacturer_part_number:row.manufacturer_part_number,
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
  const web = direct.products.length ? {status:"skipped",results:[]} : await webResearch(key,vehicle,term,category);
  const fallback = merchantClaim==="reserved" && !direct.products.length && web.results.length
    ? await offersFromWeb(web.results,vehicle,term,category) : {products:[],failures:[]};
  const products = direct.products.length ? direct.products : fallback.products;
  const failures = [...direct.failures,...fallback.failures];
  for (const {merchant,reason} of failures) console.warn("CarParts merchant",merchant,reason);
  const payload = {
    products, results:web.results, references, web_status:web.status,
    merchant_status:merchantClaim==="reserved"?(failures.length?"partial":"searched"):merchantClaim,
    merchant_failures:failures,
    provider:"mwmbl", license:"CC BY-NC-SA 4.0"
  };
  const checked = new Date();
  const hasResults = products.length || web.results.length || references.length;
  const minutes = products.length ? 240 : hasResults ? 60 : failures.length || web.status!=="live" ? 5 : 20;
  // Keep short negative results to avoid repeating a source query on every click.
  try {
    await database("shared_parts_research",{on_conflict:"query_hash"},[{
      query_hash:key,payload,checked_at:checked.toISOString(),
      expires_at:new Date(+checked+minutes*60000).toISOString()
    }]);
  } catch { console.warn("CarParts search cache write failed"); }
  return {...payload,status:hasResults?"live":"empty",fetched_at:checked.toISOString()};
}

Deno.serve(async (request:Request)=>{
  if (request.method==="OPTIONS") return new Response(null,{status:204,headers});
  if (request.method!=="POST") return json({error:"Method not allowed"},405);
  if (request.headers.get("origin")!==origin) return json({error:"Origin not permitted"},403);
  try {
    if (!publishableKeys().includes(request.headers.get("apikey")||"")) return json({error:"Invalid publishable key"},401);
    const raw = await request.text();
    if (raw.length>1200) return json({error:"Too large"},413);
    let p;
    try { p = JSON.parse(raw); } catch { return json({error:"Invalid JSON"},400); }
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
    const key = await searchKey(vehicle,term,category);
    return json(await research(vehicle,term,category,key));
  } catch (error) {
    console.error("CarParts research",error instanceof Error ? error.message : "unknown");
    return json({status:"error",products:[],results:[],references:[]},503);
  }
});
