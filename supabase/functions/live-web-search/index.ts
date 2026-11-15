// CarParts keyless web discovery: public Mwmbl JSON API, respecting its noncommercial CC BY-NC-SA license.
// 1,000 free anonymous queries/month at 1 req/s per provider IP; our daily limit is stricter.
// Show only directly relevant short references with source attribution; never mislabel as fitted parts.
// No VIN, IP, free-form user text or personal identifiers are saved.
const ORIGIN="https://zzfizez-ux.github.io";
const BASE="https://umhzxsryqhwzxrmkbmwp.supabase.co/rest/v1/";
const DOMAINS=[
 "autodoc.de","atp-autoteile.de","kfzteile24.de","motointegrator.de",
 "mister-auto.de","daparto.de","pkwteile.de","autoteile-markt.de",
 "autoteiledirekt.de","ebay.de"
];
const MAX_LOOKUPS_PER_DAY=25; // Conserve free quota; never trigger paid add-ons.
const headers={
 "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "Access-Control-Allow-Origin":ORIGIN,
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Access-Control-Allow-Headers":"content-type,apikey","Vary":"Origin",
};
const json=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{headers,status});
const pubkeys=()=>{
 try{const o=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
 return Object.values(o).filter((v):v is string=>typeof v==="string");}catch{return []}
};
const secret=()=>{
 try{const k=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
 if(typeof k.default==="string")return k.default;}catch{/* legacy key */}
 return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
};
async function db(table:string,method:"GET"|"POST",filters:Record<string,string>,body?:unknown){
 const u=new URL(BASE+table);
 Object.entries(filters).forEach(([k,v])=>u.searchParams.set(k,v));
 const key=secret();if(!key)throw Error("DB secret missing");
 const r=await fetch(u,{method,headers:{apikey:key,Accept:"application/json",
  "Content-Type":"application/json",
  Prefer:"return=representation,resolution=merge-duplicates"},
  body:method==="POST"?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(6000)});
 if(!r.ok)throw Error(table+" "+r.status);
 return await r.json();
}
function safeName(v:unknown):v is string{
 return typeof v==="string"&&v.length>0&&v.length<=70&&/^[\p{L}\p{N} .&'/-]+$/u.test(v);
}
function safePart(v:unknown):v is string{
 return typeof v==="string"&&v.length>=2&&v.length<=80&&
 /^[\p{L}\p{N}\p{M} .+/-]+$/u.test(v)&&
 !(/[A-HJ-NPR-Z0-9]{17}/.test(v.replace(/\s/g,""))||/@/.test(v));
}
const clean=(s:string,n:number)=>s.replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim().slice(0,n);
function hostAllowed(s:string){
 try{
  const u=new URL(s);
  return u.protocol==="https:"&&DOMAINS.some(d=>u.hostname===d||u.hostname.endsWith("."+d));
 }catch{return false}
}
function formatted(results:unknown, make:string, model:string, part:string){
 if(!Array.isArray(results))return [];
 const out:any[]=[],seen=new Set<string>();
 const lc=(x:string)=>x.toLocaleLowerCase("de-DE");
 const partLc=lc(part);
 const concepts=partLc.includes("brems")
  ? ["brems","brake","pad","brembo"]
  : partLc.includes("filter")?["filter","öl","oil","mann","wix"]:
    [partLc,partLc.slice(0,Math.min(5,partLc.length))];
 for(const item of results){
  if(!item||typeof item!=="object")continue;
  const x=item as Record<string,unknown>;
  if(typeof x.url!=="string"||!hostAllowed(x.url)||seen.has(x.url))continue;
  if(typeof x.title!=="string"||x.title.length<6)continue;
  const u=new URL(x.url);
  const text=lc([x.title,typeof x.content==="string"?x.content:"",u.pathname].join(" "));
  // A model name alone is not a product hit. Match the part and at least the vehicle make.
  if(!text.includes(lc(make))||!concepts.some(c=>text.includes(c)))continue;
  // Don't present mismatched models as evidence for the selected model.
  const modelLc=lc(model);
  const modelMatches=text.includes(modelLc)||(modelLc==="3er"&&/3er|3.series|320d|318d/.test(text));
  if(!modelMatches)continue;
  seen.add(x.url);
  out.push({title:clean(x.title,125),url:u.href,
   snippet:typeof x.content==="string"?clean(x.content,125):"",
   merchant:u.hostname.replace(/^www\./,""),
   price:null,image:null,fitment_verified:false});
  if(out.length>=10)break;
 }
 return out;
}
async function hash(s:string){
 const data=new TextEncoder().encode(s);
 const digest=await crypto.subtle.digest("SHA-256",data);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(req.headers.get("origin")!==ORIGIN)return json({error:"Origin not permitted"},403);
 if(!pubkeys().includes(req.headers.get("apikey")||""))return json({error:"Invalid publishable key"},401);
 try{
  if(Number(req.headers.get("content-length")||0)>700)return json({error:"Too large"},413);
  const p=await req.json();
  if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).some(k=>!["make","model","year","part","engine"].includes(k)))
   return json({error:"Invalid input"},422);
  const {make,model,part}=p;const year=Number(p.year);
  const engine=typeof p.engine==="string"?p.engine:"";
  if(!safeName(make)||!safeName(model)||!safePart(part)||
    !Number.isInteger(year)||year<1980||year>2027||
    (engine&&!(engine.length<=100&&/^[\p{L}\p{N}\p{M} .,+()/-]+$/u.test(engine))))return json({error:"Invalid vehicle/part"},422);
  const makes=await db("car_brands","GET",{select:"id",name:"eq."+make,limit:"1"});
  if(!makes.length)return json({error:"Unknown make"},422);
  const models=await db("car_models","GET",{
   select:"id",brand_id:"eq."+makes[0].id,name:"eq."+model,limit:"1"});
  if(!models.length)return json({error:"Unknown model"},422);

  // Free anonymous Mwmbl API: no account, key or payment method.
  const queryHash=await hash([make,model,year,clean(part,80),clean(engine,70)].join("|").toLowerCase());
  const now=Date.now();
  const cache=await db("live_web_search_cache","GET",{
   select:"results,checked_at,expiry,provider",query_hash:"eq."+queryHash,limit:"1"
  });
  if(cache.length&&cache[0].provider==="mwmbl"&&Date.parse(cache[0].expiry)>now){
   return json({status:"cached",provider:"mwmbl",license:"CC BY-NC-SA 4.0",
    results:cache[0].results||[],fetched_at:cache[0].checked_at,
    fitment_verified:false,prices_verified:false});
  }
  const today=new Date().toISOString().slice(0,10);
  const counts=await db("live_web_search_budget","GET",{
   select:"query_hash",lookup_day:"eq."+today,limit:String(MAX_LOOKUPS_PER_DAY+1)});
  if(counts.length>=MAX_LOOKUPS_PER_DAY||counts.some((v:any)=>v.query_hash===queryHash)){
   return json({status:"quota",provider:"mwmbl",results:[],
    message:"Kostenloses Tageslimit erreicht. Bereits gespeicherte Suchtreffer bleiben verfügbar.",
    fitment_verified:false,prices_verified:false});
  }
  const q=clean(make+" "+model+" "+part,150);
  const url="https://api.mwmbl.org/api/v2/search/?q="+encodeURIComponent(q);
  const external=await fetch(url,{
   headers:{Accept:"application/json"},
   signal:AbortSignal.timeout(13000)
  });
  if(external.status===429)return json({status:"quota",provider:"mwmbl",results:[],
   message:"Der kostenlose Suchanbieter hat sein Rate-Limit erreicht.",fitment_verified:false});
  if(!external.ok)return json({status:"provider_error",provider:"mwmbl",results:[],
   message:"Mwmbl-Websuche nicht verfügbar ("+external.status+").",fitment_verified:false});
  const payload=await external.json();
  const results=formatted(payload.results,make,model,part);
  // Store only bounded source-attributed references and aggregate query budgets.
  const fetched=new Date(),expiry=new Date(fetched.getTime()+22*3600_000);
  await db("live_web_search_budget","POST",{on_conflict:"query_hash,lookup_day"},[{
   query_hash:queryHash,lookup_day:today
  }]);
  await db("live_web_search_cache","POST",{on_conflict:"query_hash"},[{
   query_hash:queryHash,make,model,year,part_query_category:clean(part,80),
   provider:"mwmbl",results,checked_at:fetched.toISOString(),expiry:expiry.toISOString()
  }]);
  return json({status:"live",provider:"mwmbl",license:"CC BY-NC-SA 4.0",
   results,stored:true,fetched_at:fetched.toISOString(),
   fitment_verified:false,prices_verified:false});
 }catch(e){
  console.error("CarParts live search:",e instanceof Error?e.message:"unknown");
  return json({status:"error",results:[],
   message:"Websuche vorübergehend nicht verfügbar.",fitment_verified:false},200);
 }
});
