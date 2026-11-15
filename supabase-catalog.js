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
 const corpus=[part.part_name,part.manufacturer,part.manufacturer_part_number,part.category].join(" ").toLocaleLowerCase("de-DE");
 if(!q)return true;
 if(corpus.includes(q))return true;
 // Common everyday synonyms for this type of component.
 if(/dieselfilter|kraftstofffilter|spritfilter|fuel.?filter/.test(q)&&
    /kraftstofffilter/.test(corpus))return true;
 return false;
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
 return rows.filter(p=>matchesQuery(p,term)).map(p=>({
  ...p,fitment:fits.find(f=>f.part_id===p.id),engine:exact.designation
 }));
}
window.CarPartsDB={getBrands,getModels,getEngines,findVerifiedParts};
})();
