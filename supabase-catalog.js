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
async function getModels(make){
 const brands=await getBrands();
 const brand=brands.find(b=>b.name===make);
 if(!brand)return [];
 const rows=await read("car_models?select=name&brand_id=eq."+encodeURIComponent(brand.id)+"&order=name.asc&limit=250");
 return rows.map(r=>r.name).filter(x=>typeof x==="string"&&x.length>0);
}
window.CarPartsDB={getBrands,getModels};
})();
