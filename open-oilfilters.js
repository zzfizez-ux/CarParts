// Open community oil filter references. Source data: OilSpec Commons (CC0 1.0).
// Not a manufacturer-confirmed fitment catalog. Downloaded locally only after oil-filter searches.
(function(){
"use strict";
let pending=null;
function isOilFilterQuery(term){
 const q=String(term||"").trim().toLocaleLowerCase("de-DE");
 return /(?:^|\s)(?:ölfilter|oelfilter|motorölfilter|oil\s*filter|oilfilter)(?:\s|$)/i.test(q);
}
function load(){
 if(window.CARPARTS_OPEN_OILFILTERS?.rows)return Promise.resolve(window.CARPARTS_OPEN_OILFILTERS);
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const el=document.createElement("script");
  const timeout=setTimeout(()=>{el.remove();reject(Error("Community data timeout"))},10000);
  el.async=true;
  el.src="open-oilfilters-data.js?v=20261115-cc0-16";
  el.onload=()=>{clearTimeout(timeout);const d=window.CARPARTS_OPEN_OILFILTERS;
   if(d?.license==="CC0-1.0"&&Array.isArray(d.rows))resolve(d);
   else reject(Error("Community data missing"));
  };
  el.onerror=()=>{clearTimeout(timeout);reject(Error("Community data unavailable"))};
  document.head.appendChild(el);
 }).catch(e=>{pending=null;throw e});
 return pending;
}
const BRANDS=["MicroGard","MicroGard Select","WIX","WIX XP","Mobil 1","K&N"];
const api={lastInfo:null,brands:BRANDS};
async function find(vehicle,query){
 if(!isOilFilterQuery(query))return null;
 if(!vehicle?.make||!vehicle?.model||!vehicle?.year)return [];
 api.lastInfo=null;
 if(window.CarPartsDB?.discoverOilRefs){
  try{
   const result=await window.CarPartsDB.discoverOilRefs(vehicle);
   api.lastInfo={source:result.source,stored:result.stored};
   return result.rows;
  }catch(error){
   // If Edge Functions / database are temporarily unreachable, use the local CC0 snapshot.
   api.lastInfo={source:"local-fallback",stored:0};
  }
 }
 const d=await load();
 if(api.lastInfo===null)api.lastInfo={source:"local-fallback",stored:0};
 return d.rows.filter(r=>r[0]===vehicle.make&&r[1]===vehicle.model&&
  r[2]===Number(vehicle.year)).slice(0,40);
}
api.find=find;
api.isOilFilterQuery=isOilFilterQuery;
window.CarPartsOpenOil=api;
})();