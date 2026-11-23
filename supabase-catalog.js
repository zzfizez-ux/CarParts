import {catalogueEngines, catalogueParts} from "./supabase/functions/live-web-search/catalogue.mjs?v=37";
import {seriesKey, words} from "./supabase/functions/live-web-search/vehicle-fitment.mjs?v=37";

// CarParts public vehicle catalogue — safe publishable key, read-only RLS-protected tables.
// Do not put secret/service_role keys in browser code.
(function(){
"use strict";
const {url:base,publishableKey:key}=window.CARPARTS_SUPABASE_CONFIG;
let brandsPromise=null;
async function read(path){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),5500);
 try{
  const response=await fetch(base+"/rest/v1/"+path,{headers:{"apikey":key,"Accept":"application/json"},signal:controller.signal,cache:"no-store"});
  if(!response.ok)throw new Error("Supabase "+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error("Invalid catalog response");
  return rows;
 }finally{clearTimeout(timer)}
}
function getBrands(){
 if(!brandsPromise)brandsPromise=read("car_brands?select=id,name&order=name.asc&limit=150").catch(e=>{brandsPromise=null;throw e});
 return brandsPromise;
}
const modelsCache=new Map();
async function modelRows(make){
 const brands=await getBrands();
 const brand=brands.find(b=>b.name===make);
 if(!brand)return [];
 if(!modelsCache.has(brand.id)){
  const promise=read("car_models?select=id,name&brand_id=eq."+encodeURIComponent(brand.id)+"&order=name.asc&limit=250");
  modelsCache.set(brand.id,promise.catch(e=>{modelsCache.delete(brand.id);throw e}));
 }
 return modelsCache.get(brand.id);
}
async function getModels(make){
 return (await modelRows(make)).map(r=>r.name).filter(x=>typeof x==="string"&&x.length>0);
}
function readTable(table,filter){
 return read(table+"?"+new URLSearchParams(filter));
}

const engineRequests=new Map();
async function getEngines(make,model,year,series){
 if(!make||!model||!year||!series)return [];
 const cacheKey=JSON.stringify([make,model,year,series]);
 if(!engineRequests.has(cacheKey)){
  engineRequests.set(cacheKey,catalogueEngines(readTable,{make,model,year,series})
   .catch(error=>{engineRequests.delete(cacheKey);throw error}));
 }
 return engineRequests.get(cacheKey);
}

async function findVerifiedParts(vehicle,term){
 const engines=await getEngines(vehicle.make,vehicle.model,vehicle.year,vehicle.series);
 const selected=await catalogueParts(readTable,engines,vehicle,term,researchCategory(term));
 if(!selected.length)return [];
 const ids=[...new Set(selected.map(p=>p.id))];
 const freshSince=new Date(Date.now()-7*24*60*60*1000).toISOString();
 const images=[],offers=[];
 for(let start=0;start<ids.length;start+=100){
  const filter="part_id=in.("+ids.slice(start,start+100).join(",")+")";
  const [imageRows,offerRows]=await Promise.allSettled([
   read("part_images?select=part_id,image_url,alt_text,source_url&"+
    filter+"&verified_for_display=eq.true&limit=1000"),
   read("part_offers?select=part_id,merchant_name,price_amount,currency,availability,observed_at,product_url,source_url,image_url&"+
    filter+"&verification_status=eq.verified&observed_at=gte."+encodeURIComponent(freshSince)+"&order=price_amount.asc&limit=1000")
  ]);
  if(imageRows.status==="fulfilled")images.push(...imageRows.value);
  if(offerRows.status==="fulfilled")offers.push(...offerRows.value);
 }
 return selected.map(p=>({
  ...p,images:images.filter(x=>x.part_id===p.id),
  offers:offers.filter(x=>x.part_id===p.id)
 }));
}
async function getCoverage(make,model,year,series){
 const engines=await getEngines(make,model,year,series);
 if(!engines.length)return {documentedEngines:0,verifiedArticles:0};
 const rows=await readTable("part_fitments",{
  select:"part_id,series_keys",engine_id:"in.("+engines.map(e=>e.id).join(",")+")",status:"eq.verified",limit:"1000",
  and:"(or(year_from.is.null,year_from.lte."+year+"),or(year_to.is.null,year_to.gte."+year+"))"
 });
 const key=seriesKey(make,model,series);
 const matching=rows.filter(row=>!row.series_keys||row.series_keys.includes(key));
 return {documentedEngines:engines.length,verifiedArticles:new Set(matching.map(x=>x.part_id)).size};
}
async function discoverOilRefs(vehicle){
 const payload={
  make:String(vehicle.make||""),model:String(vehicle.model||""),
  year:Number(vehicle.year),category:"oilfilter"
 };
 const response=await fetch(base+"/functions/v1/discover-parts",{
  method:"POST",
  headers:{"apikey":key,"Content-Type":"application/json"},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000),
 });
 if(!response.ok)throw new Error("Open community search "+response.status);
 const result=await response.json();
 if(!result||result.license!=="CC0-1.0"||!Array.isArray(result.rows)||
    result.rows.some(r=>!Array.isArray(r)||r.length!==6)){
  throw new Error("Unexpected community search response");
 }
 return {rows:result.rows,source:result.source,stored:result.stored||0};
}
// Research entries are never part of the verified fitment table.
const researchCategories=[
 "Bremsbeläge","Bremsscheiben","Ölfilter","Kraftstofffilter","Luftfilter","Innenraumfilter",
 "Bremssättel","Bremsleitungen","Bremsflüssigkeit","Zündkerzen","Glühkerzen","Zahnriemen",
 "Keilrippenriemen","Wasserpumpe","Thermostat","Kühler","Kühlmittelschlauch","Lichtmaschine",
 "Anlasser","Batterie","Stoßdämpfer","Fahrwerksfedern","Querlenker","Spurstangenkopf",
 "Radlager","Kupplung","Schwungrad","Getriebeöl","Motoröl","Dichtungen",
 "Scheibenwischer","Scheinwerfer","Rückleuchten","Außenspiegel","Klimakompressor",
 "Lambdasonde","Luftmassenmesser","Turbolader","AGR-Ventil","Katalysator",
 "Partikelfilter","Auspuff","Einspritzdüsen","Zündspulen","Riemenspanner",
 "Bremsschlauch","Hauptbremszylinder","Kupplungsgeberzylinder","Kupplungsnehmerzylinder",
 "Zentralausrücker","Bremsbelagverschleißsensor","Traggelenk","Getriebefilter","Koppelstange",
 "Axialgelenk","Fahrzeugtür","Türaußenhaut","Scheinwerferhalter","Kompressor-Ansaugfilter",
 "Radbremszylinder","Bremstrommeln","Bremsbacken","Bremsbackensatz"
];
function researchCategory(term){
 const t=words(term);
 const aliases={
  "brake pads":"Bremsbeläge","brake pad":"Bremsbeläge","bremsklotze":"Bremsbeläge",
  "bremsbelag":"Bremsbeläge","bremsscheibe":"Bremsscheiben","brake discs":"Bremsscheiben",
  "brake rotors":"Bremsscheiben","oil filter":"Ölfilter","oilfilter":"Ölfilter",
  "oelfilter":"Ölfilter","dieselfilter":"Kraftstofffilter","fuel filter":"Kraftstofffilter",
  "air filter":"Luftfilter","cabin filter":"Innenraumfilter","spark plugs":"Zündkerzen",
  "zundkerze":"Zündkerzen","gluhkerze":"Glühkerzen","headlight":"Scheinwerfer",
  "windshield wipers":"Scheibenwischer","lenker":"Querlenker","achslenker":"Querlenker",
  "control arm":"Querlenker","bremsschlauche":"Bremsschlauch","brake hose":"Bremsschlauch",
  "traggelenke":"Traggelenk","fuhrungsgelenk":"Traggelenk","warnkontakt":"Bremsbelagverschleißsensor",
  "geberzylinder":"Kupplungsgeberzylinder","nehmerzylinder":"Kupplungsnehmerzylinder",
  "tuer":"Fahrzeugtür","tur":"Fahrzeugtür","tueraussenhaut":"Türaußenhaut",
  "koppelstangen":"Koppelstange","spurstangenkopfe":"Spurstangenkopf",
  "bremstrommel":"Bremstrommeln","brake drum":"Bremstrommeln","brake drums":"Bremstrommeln",
  "bremsbacke":"Bremsbacken","brake shoes":"Bremsbacken","brake shoe":"Bremsbacken",
  "brake shoe kit":"Bremsbackensatz","brake wheel cylinder":"Radbremszylinder",
  "keilrippenriemensatz":"Keilrippenriemen"
 };
 const synonym=Object.keys(aliases).sort((a,b)=>b.length-a.length).find(name=>t===name||t.startsWith(name+" "));
 if(synonym)return aliases[synonym];
 return researchCategories.find(c=>t===words(c)||t.startsWith(words(c)+" "))||null;
}
async function researchParts(vehicle,term){
 const category=researchCategory(term);
 if(!category)return null;
 const body={make:vehicle.make,model:vehicle.model,year:Number(vehicle.year),category};
 const res=await fetch(base+"/functions/v1/research-parts",{
  method:"POST",headers:{"apikey":key,"Content-Type":"application/json"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(12000)
 });
 if(!res.ok)throw new Error("Research service "+res.status);
 const result=await res.json();
 if(!result||!Array.isArray(result.rows))throw new Error("Research response invalid");
 return result;
}
async function searchLiveWeb(vehicle,term){
 const request={
  make:vehicle.make,model:vehicle.model,series:vehicle.series||"",year:Number(vehicle.year),
  engine:vehicle.engine||"",variant:vehicle.variant||"",part:term.trim(),category:researchCategory(term)||""
 };
 const res=await fetch(base+"/functions/v1/live-web-search",{
  method:"POST",headers:{"apikey":key,"Content-Type":"application/json"},
  body:JSON.stringify(request),signal:AbortSignal.timeout(56000)
 });
 if(!res.ok)throw new Error("Live web search "+res.status);
 const data=await res.json();
 if(!data||!Array.isArray(data.results))throw new Error("Unexpected web search result");
 return data;
}
// Both evidence tables have independent read-only RLS and attribution licenses.
// Registry matches DO NOT verify individual vehicle parts or even exact production year.
const registryPromises=new Map();
function getRegistryEvidence(make,model){
 if(!make||!model)return Promise.resolve(null);
 const k=make+"|"+model;
 if(!registryPromises.has(k)){
  const promise=read("vehicle_registry_evidence?select=registry_model,registry_id,model_first_year,model_last_year,german_registration,country_codes,body_types,source_license,source_url"+
   "&make=eq."+encodeURIComponent(make)+"&model=eq."+encodeURIComponent(model)+"&limit=1")
   .then(rows=>rows[0]||null).catch(e=>{registryPromises.delete(k);throw e});
  registryPromises.set(k,promise);
 }
 return registryPromises.get(k);
}
function diagnosticCode(term){
 const t=String(term||"").trim().toUpperCase();
 return /^[PBCU][0-9A-F]{4}$/.test(t)?t:null;
}
async function findDiagnosticParts(term,make){
 const code=diagnosticCode(term);
 if(!code)return null;
 const q="open_diagnostic_parts?select=dtc_code,code_name,part_name,system_category,oem_make,source_url,license"+
  "&dtc_code=eq."+encodeURIComponent(code)+
  "&or=(oem_make.is.null,oem_make.eq."+encodeURIComponent(make||"")+")"+
  "&order=part_name.asc&limit=30";
 return read(q);
}
window.CarPartsDB={getBrands,getModels,getEngines,findVerifiedParts,getCoverage,discoverOilRefs,researchParts,researchCategory,searchLiveWeb,getRegistryEvidence,findDiagnosticParts,diagnosticCode};
})();


