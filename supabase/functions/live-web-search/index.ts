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
const normalize=(s:string)=>s.normalize("NFKC").trim().replace(/\s+/g," ");
function validField(value:unknown,max:number,required=false):value is string{
 return typeof value==="string" && value.length<=max && (!required||!!value.trim()) &&
  /^[\p{L}\p{N}\p{M} &'’.,+()#:/_–—-]*$/u.test(value) &&
  !/\b[A-HJ-NPR-Z0-9]{17}\b/i.test(value);
}
async function readResult(key:string){
 const rows=await db("shared_parts_research","GET",{select:"payload,checked_at",
  query_hash:"eq."+key,expires_at:"gt."+new Date().toISOString(),limit:"1"});
 return rows[0]?{...rows[0].payload,status:"cached",fetched_at:rows[0].checked_at}:null;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(req.headers.get("origin")!==ORIGIN)return json({error:"Origin not permitted"},403);
 if(!pubkeys().includes(req.headers.get("apikey")||""))return json({error:"Invalid publishable key"},401);
 try{
  const raw=await req.text();
  if(raw.length>1200)return json({error:"Too large"},413);
  let p;try{p=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
  if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).some(k=>
   !["make","model","year","part","engine","series","variant","category"].includes(k)))return json({error:"Invalid input"},422);
  const {year}=p;
  if(!validField(p.make,90,true)||!validField(p.model,140,true)||!validField(p.part,80,true)||
   !Number.isInteger(year)||year<1885||year>new Date().getUTCFullYear()+1||
   !validField(p.engine??"",160)||!validField(p.series??"",160)||!validField(p.variant??"",100)||
   !validField(p.category??"",80))return json({error:"Invalid vehicle/part"},422);
  const [make,model,series,engine,variant,part,category]=
   [p.make,p.model,p.series||"",p.engine||"",p.variant||"",p.part,p.category||""].map(normalize);
  const key=await hash(JSON.stringify([make,model,series,year,engine,variant,part,category]).toLowerCase());
  const saved=await readResult(key);
  if(saved)return json(saved);
  const references=category?await db("research_part_candidates","GET",{
   select:"manufacturer,manufacturer_part_number,part_name,source_vehicle_variant,fitment_conditions,source_url,year_from,year_to",
   make:"eq."+make,model:"eq."+model,category:"eq."+category,
   and:"(or(year_from.is.null,year_from.lte."+year+"),or(year_to.is.null,year_to.gte."+year+"))",
   order:"manufacturer.asc,manufacturer_part_number.asc",limit:"20"
  }):[];
  const claim=await db("rpc/reserve_parts_web_lookup","POST",{},{key_hash:key});
  if(claim==="busy"){
   for(const delay of [500,1000,2000,3000,5000]){
    await new Promise(resolve=>setTimeout(resolve,delay));
    const hit=await readResult(key);if(hit)return json(hit);
   }
   return json({status:"busy",results:[],references});
  }
  let results:ReturnType<typeof formatted>=[],web_status="quota";
  if(claim==="reserved"){
   const query=[make,model,series,year,engine,variant,part].filter(Boolean).join(" ");
   const url="https://api.mwmbl.org/api/v2/search/?q="+encodeURIComponent(query);
   try{
    const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(12000)});
    web_status=r.status===429?"quota":"provider_error";
    if(r.ok){
     const data=await r.json();
     if(Array.isArray(data.results)){results=formatted(data.results,make,model,part);web_status="live"}
    }
   }catch{web_status="provider_error"}
  }
  const payload={results,references,web_status,provider:"mwmbl",license:"CC BY-NC-SA 4.0",
   fitment_verified:false,prices_verified:false};
  const checked=new Date();
  if(web_status!=="live"&&!references.length)return json({...payload,status:web_status});
  const hours=results.length?22:references.length?22:1;
  await db("shared_parts_research","POST",{on_conflict:"query_hash"},[{
   query_hash:key,payload,checked_at:checked.toISOString(),expires_at:new Date(+checked+hours*3600000).toISOString()
  }]);
  return json({...payload,status:"live",stored:true,fetched_at:checked.toISOString()});
 }catch(e){
  console.error("CarParts shared research",e instanceof Error?e.message:"unknown");
  return json({status:"error",results:[],references:[]},503);
 }
});
