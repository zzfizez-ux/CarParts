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
async function find(vehicle,query){
 if(!isOilFilterQuery(query))return null;
 const d=await load();
 if(!vehicle?.make||!vehicle?.model||!vehicle?.year)return [];
 return d.rows.filter(r=>r[0]===vehicle.make&&r[1]===vehicle.model&&
  r[2]===Number(vehicle.year)).slice(0,60);
}
window.CarPartsOpenOil={find,isOilFilterQuery};
})();