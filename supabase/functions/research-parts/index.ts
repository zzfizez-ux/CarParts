// CarParts source-reviewed research catalog and privacy-safe demand queue.
// This is NOT a general web crawler. It returns reviewed public manufacturer references,
// and records category demand until further legally reusable source adapters are approved.
import {siteRequest} from "../_shared/site-config.mjs";
import {JsonBodyError, readJson} from "../_shared/read-json.mjs";

const PROJECT="umhzxsryqhwzxrmkbmwp";
const API="https://"+PROJECT+".supabase.co/rest/v1/";
const allowedCategories=new Set([
 "Bremsbeläge","Bremsscheiben","Ölfilter","Kraftstofffilter","Luftfilter","Innenraumfilter",
 "Bremssättel","Bremsleitungen","Bremsflüssigkeit","Zündkerzen","Glühkerzen",
 "Zahnriemen","Keilrippenriemen","Wasserpumpe","Thermostat","Kühler","Kühlmittelschlauch",
 "Lichtmaschine","Anlasser","Batterie","Stoßdämpfer","Fahrwerksfedern","Querlenker",
 "Spurstangenkopf","Radlager","Kupplung","Schwungrad","Getriebeöl","Motoröl",
 "Dichtungen","Scheibenwischer","Scheinwerfer","Rückleuchten","Außenspiegel",
 "Klimakompressor","Lambdasonde","Luftmassenmesser","Turbolader","AGR-Ventil",
 "Katalysator","Partikelfilter","Auspuff","Einspritzdüsen","Zündspulen","Riemenspanner"
]);
function keyMatch(k:string){
 try{const p=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
  return !!k && Object.values(p).includes(k);
 }catch{return false}
}
function service(){
 try{const s=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  if(typeof s.default==="string")return s.default;
 }catch{/* Legacy project key below */}
 return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
}
async function sql(table:string,method:"GET"|"POST",filters:Record<string,string>,body?:unknown){
 const u=new URL(API+table);
 Object.entries(filters).forEach(([key,value])=>u.searchParams.set(key,value));
 const token=service();if(!token)throw Error("Server credential unavailable");
 const r=await fetch(u,{method,headers:{"apikey":token,"Content-Type":"application/json",
 "Accept":"application/json","Prefer":"return=representation,resolution=ignore-duplicates"},
 body:method==="POST"?JSON.stringify(body):undefined,signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error("Supabase query "+r.status);
 return r.json();
}
const safeName=(s:unknown):s is string=>
 typeof s==="string"&&s.length>0&&s.length<=70&&/^[\p{L}\p{N} .&'/-]+$/u.test(s);
Deno.serve(async(req:Request)=>{
 const {allowed,headers,json:response}=siteRequest(req,"content-type, apikey");
 if(!allowed)return response({error:"Origin denied"},403);
 if(req.method==="OPTIONS")return new Response(null,{headers,status:204});
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 if(!keyMatch(req.headers.get("apikey")||""))return response({error:"Invalid publishable key"},401);
 try{
  const v=await readJson(req,1024);
  if(!v||typeof v!=="object"||Array.isArray(v)||
   Object.keys(v).some(x=>!["make","model","year","category"].includes(x)))return response({error:"Unsupported request"},422);
  const {make,model,category}=v,year=Number(v.year);
  if(!safeName(make)||!safeName(model)||!Number.isInteger(year)||year<1980||year>2027||
    !allowedCategories.has(category))return response({error:"Unknown vehicle/category"},422);
  const brands=await sql("car_brands","GET",{select:"id",name:"eq."+make,limit:"1"});
  if(!brands.length)return response({error:"Unsupported brand"},422);
  const models=await sql("car_models","GET",{select:"id",name:"eq."+model,
   brand_id:"eq."+brands[0].id,limit:"1"});
  if(!models.length)return response({error:"Unsupported model"},422);
  const filter={make:"eq."+make,model:"eq."+model,category:"eq."+category,
   "and":"(or(year_from.is.null,year_from.lte."+year+"),or(year_to.is.null,year_to.gte."+year+"))"};
  const rows=await sql("research_part_candidates","GET",{
   select:"manufacturer,manufacturer_part_number,part_name,source_vehicle_variant,fitment_conditions,source_url,fitment_status,year_from,year_to,reviewed_at",
   ...filter,order:"manufacturer.asc,manufacturer_part_number.asc",limit:"20"});
  const existing=await sql("research_part_requests","GET",{select:"status",
   make:"eq."+make,model:"eq."+model,model_year:"eq."+year,
   category:"eq."+category,limit:"1"});
  let saved=false;
  if(!existing.length){
   // Free-plan guard: at most 200 distinct recent research requests/day.
   const count=await sql("research_part_requests","GET",{
    select:"make",first_requested:"gte."+new Date(Date.now()-86400000).toISOString(),limit:"201"});
   if(count.length<200){
    await sql("research_part_requests","POST",{on_conflict:"make,model,model_year,category"},[{
     make,model,model_year:year,category,status:rows.length?"source_candidates_available":"needs_authorized_source"
    }]);
    saved=true;
   }
  }
  return response({rows,source:"reviewed_manufacturer_research",
   category,search_saved:saved||existing.length>0,
   complete:false,auto_web_crawler:false,fitment_verified:false,
   message:rows.length
    ?"Hersteller-Referenzen gefunden: Fahrzeugvariante und Bremsanlage prüfen."
    :"Suchanfrage erfasst. Für diese Kategorie fehlt noch eine freigegebene externe Datenquelle."});
 }catch(e){
  if(e instanceof JsonBodyError)return response({error:e.message},e.status);
  console.error("CarParts research lookup",e instanceof Error?e.message:"unknown error");
  return response({error:"Research temporarily unavailable"},503);
 }
});
