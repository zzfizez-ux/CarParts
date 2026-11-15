// CarParts optional live web search: server-side Tavily adapter.
// Only when an authorized operator sets TAVILY_API_KEY in Supabase Edge Function secrets.
// Store/display web-result metadata only after verifying third-party reuse rights.
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
function formatted(results:unknown){
 if(!Array.isArray(results))return [];
 const out:any[]=[],seen=new Set<string>();
 for(const item of results){
  if(!item||typeof item!=="object")continue;
  const x=item as Record<string,unknown>;
  if(typeof x.url!=="string"||!hostAllowed(x.url)||seen.has(x.url))continue;
  if(typeof x.title!=="string"||x.title.length<6)continue;
  const u=new URL(x.url);seen.add(x.url);
  out.push({title:clean(x.title,140),url:u.href,
   snippet:typeof x.content==="string"?clean(x.content,170):"",
   merchant:u.hostname.replace(/^www\./,""),
   // Prices/images can't be reliably verified from generic web search snippets.
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

  const providerKey=Deno.env.get("TAVILY_API_KEY");
  if(!providerKey)return json({status:"not_configured",results:[],
   message:"Es ist noch kein autorisierter Websuchanbieter für CarParts verbunden.",
   fitment_verified:false,prices_verified:false});
  const cacheEnabled=Deno.env.get("WEB_SEARCH_CACHE_ALLOWED")==="true";
  const queryHash=await hash([make,model,year,clean(part,80),clean(engine,70)].join("|").toLowerCase());
  const now=Date.now();
  if(cacheEnabled){
   const rows=await db("live_web_search_cache","GET",{select:"results,checked_at,expiry",
    query_hash:"eq."+queryHash,limit:"1"});
   if(rows.length&&Date.parse(rows[0].expiry)>now){
    return json({status:"cached",results:rows[0].results||[],
     fetched_at:rows[0].checked_at,fitment_verified:false,prices_verified:false});
   }
  }
  const today=new Date().toISOString().slice(0,10);
  const counts=await db("live_web_search_budget","GET",{
   select:"query_hash",lookup_day:"eq."+today,limit:String(MAX_LOOKUPS_PER_DAY+1)});
  if(counts.length>=MAX_LOOKUPS_PER_DAY)return json({status:"quota",results:[],
   message:"Tageslimit für kostenlose Websuchen erreicht.",fitment_verified:false},200);
  if(counts.some((v:any)=>v.query_hash===queryHash))return json({status:"quota",results:[],
   message:"Diese Suche wurde heute bereits abgefragt. Für erneute Live-Abfragen gilt ein Tageslimit.",fitment_verified:false});
  // Only ONE basic search per distinct vehicle/part query to stay within free credits.
  const q=clean(make+" "+model+" "+year+" "+(engine?engine+" ":"")+
    part+" kaufen Preis Ersatzteile Deutschland",220);
  const r=await fetch("https://api.tavily.com/search",{
   method:"POST",headers:{"Authorization":"Bearer "+providerKey,"Content-Type":"application/json"},
   body:JSON.stringify({query:q,topic:"general",search_depth:"basic",max_results:10,
    include_answer:false,include_raw_content:false,include_images:false,
    include_domains:DOMAINS,auto_parameters:false,safe_search:true}),
   signal:AbortSignal.timeout(18000),
  });
  if(!r.ok){
   const status=r.status===429?"quota":"provider_error";
   return json({status,results:[],message:"Websuchanbieter nicht verfügbar ("+r.status+").",fitment_verified:false});
  }
  const data=await r.json();
  const results=formatted(data.results);
  // Record aggregate usage only; no VIN, IP or user identity.
  await db("live_web_search_budget","POST",{on_conflict:"query_hash,lookup_day"},[{
   query_hash:queryHash,lookup_day:today}]);
  if(cacheEnabled){
   const checkedAt=new Date(),expiry=new Date(checkedAt.getTime()+24*3600_000);
   await db("live_web_search_cache","POST",{on_conflict:"query_hash"},[{
    query_hash:queryHash,make,model,year,part_query_category:clean(part,80),
    provider:"tavily",results,checked_at:checkedAt.toISOString(),expiry:expiry.toISOString()
   }]);
  }
  return json({status:"live",results,fetched_at:new Date().toISOString(),
   stored:cacheEnabled,fitment_verified:false,prices_verified:false});
 }catch(e){
  console.error("CarParts live search:",e instanceof Error?e.message:"unknown");
  return json({status:"error",results:[],
   message:"Websuche vorübergehend nicht verfügbar.",fitment_verified:false},200);
 }
});
