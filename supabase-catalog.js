// CarParts public vehicle catalogue — safe publishable key, read-only RLS-protected tables.
// Do not put secret/service_role keys in browser code.
(function(){
"use strict";
const base="https://umhzxsryqhwzxrmkbmwp.supabase.co";
const key="sb_publishable_NHGz3NHOpX97VDO2GLd08w_5kCpkYHI";
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
async function getEngines(make,model,year){
 if(!make||!model)return [];
 const models=await modelRows(make);
 const match=models.find(m=>m.name===model);
 if(!match)return [];
 const rows=await read("car_engines?select=id,designation,engine_code,year_from,year_to&model_id=eq."+encodeURIComponent(match.id)+"&order=designation.asc&limit=250");
 return rows.filter(r=>!year||(
  (!r.year_from||Number(year)>=r.year_from)&&(!r.year_to||Number(year)<=r.year_to)
 ));
}
function matchesQuery(part,term){
 const q=String(term||"").trim().toLocaleLowerCase("de-DE");
 if(!q)return true;
 const corpus=[part.part_name,part.manufacturer,part.manufacturer_part_number,part.category]
  .join(" ").toLocaleLowerCase("de-DE");
 if(corpus.includes(q))return true;
 // Match German and English search names without claiming compatibility.
 const aliases={
  "oil filter":"ölfilter","oilfilter":"ölfilter","oelfilter":"ölfilter",
  "motorölfilter":"ölfilter","fuel filter":"kraftstofffilter",
  "fuel filters":"kraftstofffilter","dieselfilter":"kraftstofffilter",
  "spritfilter":"kraftstofffilter","air filter":"luftfilter",
  "airfilter":"luftfilter","engine air filter":"luftfilter",
  "motorluftfilter":"luftfilter","cabin filter":"innenraumfilter",
  "pollenfilter":"innenraumfilter","brake pads":"bremsbeläge",
  "brake discs":"bremsscheiben","spark plugs":"zündkerzen",
  "headlight":"scheinwerfer","windshield wipers":"scheibenwischer"
 };
 const normalized=aliases[q]||q;
 if(corpus.includes(normalized))return true;
 // Product IDs may be written with or without spaces and punctuation.
 const compact=x=>x.replace(/[\\s\\/._-]/g,"");
 return compact(q).length>=5&&compact(corpus).includes(compact(q));
}
async function findVerifiedParts(vehicle,term){
 const engines=await getEngines(vehicle.make,vehicle.model,vehicle.year);
 // A generic engine choice (e.g. "2.0 TDI") must NEVER imply exact fitment.
 const exact=engines.find(e=>e.designation===vehicle.engine);
 if(!exact)return [];
 const fits=await read("part_fitments?select=part_id,source_url,notes&engine_id=eq."+
  encodeURIComponent(exact.id)+"&status=eq.verified&limit=100");
 if(!fits.length)return [];
 const ids=[...new Set(fits.map(f=>f.part_id).filter(Number.isInteger))];
 if(!ids.length)return [];
 const rows=await read("parts?select=id,manufacturer,part_name,manufacturer_part_number,category,source_url,verification_status"+
  "&verification_status=eq.verified&id=in.("+ids.join(",")+")&limit=100");
 const selected=rows.filter(p=>matchesQuery(p,term));
 if(!selected.length)return [];
 const selectedIds=selected.map(p=>p.id);
 const filter="part_id=in.("+selectedIds.join(",")+")";
 // Media only has public read access when separately reviewed for reuse.
 // Offers are sourced merchant listings, not automatic fitment confirmations.
 const results=await Promise.allSettled([
  read("part_images?select=part_id,image_url,alt_text,source_url&"+
    filter+"&verified_for_display=eq.true&limit=100"),
  read("part_offers?select=part_id,merchant_name,price_amount,currency,availability,observed_at,product_url,source_url&"+
    filter+"&verification_status=eq.verified&order=price_amount.asc&limit=100")
 ]);
 const images=results[0].status==="fulfilled"?results[0].value:[];
 const offers=results[1].status==="fulfilled"?results[1].value:[];
 const freshThreshold=Date.now()-7*24*60*60*1000;
 return selected.map(p=>({
  ...p,
  fitment:fits.find(f=>f.part_id===p.id),
  engine:exact.designation,
  images:images.filter(x=>x.part_id===p.id),
  offers:offers.filter(x=>x.part_id===p.id&&
    Number.isFinite(Date.parse(x.observed_at))&&Date.parse(x.observed_at)>=freshThreshold)
 }));

}
async function getCoverage(make,model,year){
 const engines=await getEngines(make,model,year);
 if(!engines.length)return {documentedEngines:0,verifiedArticles:0};
 const ids=engines.map(e=>e.id).filter(Number.isInteger);
 if(!ids.length)return {documentedEngines:0,verifiedArticles:0};
 const rows=await read("part_fitments?select=part_id&engine_id=in.("+ids.join(",")+")&status=eq.verified&limit=1000");
 return {documentedEngines:engines.length,verifiedArticles:new Set(rows.map(x=>x.part_id)).size};
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
 "Partikelfilter","Auspuff","Einspritzdüsen","Zündspulen","Riemenspanner"
];
function researchCategory(term){
 const t=String(term||"").trim().toLocaleLowerCase("de-DE");
 const aliases={
  "brake pads":"Bremsbeläge","brake pad":"Bremsbeläge","bremsklötze":"Bremsbeläge",
  "bremsbelag":"Bremsbeläge","bremsbeläge vorne":"Bremsbeläge",
  "bremsbeläge hinten":"Bremsbeläge","brake discs":"Bremsscheiben",
  "brake rotors":"Bremsscheiben","oil filter":"Ölfilter","oilfilter":"Ölfilter",
  "oelfilter":"Ölfilter","dieselfilter":"Kraftstofffilter","fuel filter":"Kraftstofffilter",
  "air filter":"Luftfilter","cabin filter":"Innenraumfilter","spark plugs":"Zündkerzen",
  "headlight":"Scheinwerfer","windshield wipers":"Scheibenwischer"
 };
 if(aliases[t])return aliases[t];
 return researchCategories.find(c=>c.toLocaleLowerCase("de-DE")===t)||
  researchCategories.find(c=>t.startsWith(c.toLocaleLowerCase("de-DE")+" "))||null;
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
window.CarPartsDB={getBrands,getModels,getEngines,findVerifiedParts,getCoverage,discoverOilRefs,researchParts,researchCategory};
})();
