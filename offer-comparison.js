import {googleProductLink} from "./supabase/functions/live-web-search/product-link.mjs?v=49";
const DAY=24*60*60*1000;
export function comparisonUrl(raw){
 try{const url=new URL(raw);if(url.protocol!=="https:"||url.username||url.password||url.port||/(^|\.)ebay\.[a-z.]+$/i.test(url.hostname))return "";if(/(^|\.)google\.[a-z.]+$/i.test(url.hostname))return googleProductLink(raw);url.hash="";return url.href;}catch{return "";}
}
const amount=value=>(typeof value==="number"||typeof value==="string"&&/^\d+(\.\d{1,2})?$/.test(value))&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
const text=(value,max=1400)=>typeof value==="string"?value.slice(0,max):"";
const key=value=>String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
function ratingFact(value){
 if(!value||![value.value,value.best,value.worst,value.count].every(Number.isFinite)||value.best<=value.worst||value.value<value.worst||value.value>value.best||!Number.isInteger(value.count)||value.count<1)return null;
 return {value:value.value,best:value.best,worst:value.worst,count:value.count};
}
function productRow(item,order){
 const url=comparisonUrl(item.url);if(!url)return null;
 const price=item.currency==="EUR"?amount(item.price):null,facts=item.facts||{};
 const shipping=typeof facts.shipping_price==="number"&&Number.isFinite(facts.shipping_price)&&facts.shipping_price>=0&&facts.shipping_currency==="EUR"?facts.shipping_price:null;
 return {url,kind:"product",order,name:text(item.name,200)||"Händlerangebot",description:text(item.description),
  merchant:text(item.merchant,120)||new URL(url).hostname,manufacturer:text(item.manufacturer,120),sku:text(item.sku,90),
  price,image:comparisonUrl(item.image),offerLinkType:text(item.offer_link_type,20),priceSource:text(item.price_source,120),imageSource:text(item.image_source,120),observedAt:text(item.observed_at,40),factsAt:"",sourceUrl:comparisonUrl(item.source_url),
  fitment:item.fitment_status||"unconfirmed",unresolved:Array.isArray(item.fitment_unresolved)?item.fitment_unresolved:[],
  conflicts:Array.isArray(item.fitment_conflicts)?item.fitment_conflicts:[],condition:text(item.condition),
  availability:text(facts.availability,60),itemCondition:text(facts.item_condition,30)||"unknown",
  quantity:Number.isInteger(facts.pack_quantity)&&facts.pack_quantity>0?facts.pack_quantity:null,
  rating:ratingFact(facts.rating),ratingSource:text(facts.rating_source,100),deliveryNote:text(facts.delivery_note,160),shipping,total:price!==null&&shipping!==null?Math.round((price+shipping)*100)/100:null};
}

// A current retailer response replaces an older observation, including a withdrawn price.
export function buildComparison({catalogue=[],products=[],sources=[]}={}){
 const rows=new Map();let order=0;
 for(const part of catalogue){
  for(const offer of part.offers||[]){
   const row=productRow({url:offer.product_url,name:[part.manufacturer,part.part_name,part.manufacturer_part_number].filter(Boolean).join(" · "),
    manufacturer:part.manufacturer,sku:part.manufacturer_part_number,description:part.part_name,merchant:offer.merchant_name,
    price:offer.price_amount,currency:offer.currency,image:offer.image_url,observed_at:offer.observed_at,
    source_url:part.fitment?.source_url||part.source_url,condition:part.fitment?.notes||part.engine,
    fitment_status:part.assessment?.status,fitment_unresolved:part.assessment?.unresolved,fitment_conflicts:part.assessment?.conflicts,
    facts:{availability:offer.availability}},order++);
   if(!row)continue;
   const prior=rows.get(row.url);if(!prior||Date.parse(row.observedAt)>=Date.parse(prior.observedAt))rows.set(row.url,row);
  }
 }
 for(const item of products){
  const row=productRow(item,order++);if(!row)continue;
  const prior=rows.get(row.url);
  const older=prior&&Number.isFinite(Date.parse(prior.observedAt))&&Number.isFinite(Date.parse(row.observedAt))&&Date.parse(row.observedAt)<Date.parse(prior.observedAt);
  if(!older)rows.set(row.url,{...row,order:prior?.order??row.order});
  else if(Date.parse(prior.observedAt)-Date.parse(row.observedAt)<=60*60*1000){
   // Preserve recent product facts while keeping the newest observed article price.
   // The two observation times stay separate and visible.
   rows.set(row.url,{...row,price:prior.price,image:prior.image||row.image,observedAt:prior.observedAt,factsAt:row.observedAt,
    fitment:prior.fitment,unresolved:prior.unresolved,conflicts:prior.conflicts,order:prior.order,
    total:prior.price!==null&&row.shipping!==null?Math.round((prior.price+row.shipping)*100)/100:null});
  }
 }
 for(const source of sources){
  const url=comparisonUrl(source.url);if(!url||rows.has(url))continue;
  rows.set(url,{url,kind:"source",order:order++,name:text(source.title,200)||new URL(url).hostname,
   description:text(source.snippet),merchant:new URL(url).hostname,manufacturer:"",sku:"",price:null,image:"",observedAt:"",sourceUrl:"",
   fitment:"unconfirmed",unresolved:[],conflicts:[],condition:"",availability:"",itemCondition:"unknown",quantity:null,rating:null,shipping:null,total:null});
 }
 return [...rows.values()];
}
export function recommendationEligible(row,now=Date.now()){
 const age=now-Date.parse(row.observedAt);
 return row.kind==="product"&&row.price!==null&&!!row.image&&["application_found","reference_match","cross_reference_found"].includes(row.fitment)&&
  !row.conflicts.length&&!row.unresolved.length&&Number.isFinite(age)&&age>=-5*60*1000&&age<=DAY&&
  !/outofstock|soldout|discontinued|preorder|backorder|nicht.*lieferbar|ausverkauft/i.test(row.availability.replace(/[\s_-]/g,""))&&
  ["new","unknown"].includes(row.itemCondition);
}
export function rated(row){return !!row.rating&&row.rating.best===5&&row.rating.worst===1&&row.rating.count>=5;}
const byPrice=(a,b)=>(a.price??Infinity)-(b.price??Infinity)||a.order-b.order;
export const ratingConfidence=row=>rated(row)?(row.rating.value*row.rating.count+3.5*20)/(row.rating.count+20):-1;
const byRating=(a,b)=>ratingConfidence(b)-ratingConfidence(a)||(b.rating?.count||0)-(a.rating?.count||0)||byPrice(a,b);
export function comparisonRecommendations(rows,now=Date.now()){
 const eligible=rows.filter(row=>recommendationEligible(row,now));
 const price=[...eligible].sort(byPrice)[0]||null;
 const quality=eligible.filter(row=>rated(row)&&row.rating.value>=4).sort(byRating)[0]||null;
 const value=eligible.filter(row=>rated(row)&&row.rating.value>=4).sort(byPrice)[0]||null;
 return {price,quality,value,featured:quality};
}
export function sortComparison(rows,mode="recommended",now=Date.now()){
 const copy=[...rows];
 if(mode==="price")return copy.sort(byPrice);
 if(mode==="rating")return copy.sort(byRating);
 if(mode==="total")return copy.sort((a,b)=>(a.total??Infinity)-(b.total??Infinity)||byPrice(a,b));
 if(mode==="value")return copy.sort((a,b)=>Number(recommendationEligible(b,now)&&rated(b)&&b.rating.value>=4)-Number(recommendationEligible(a,now)&&rated(a)&&a.rating.value>=4)||byPrice(a,b));
 return copy.sort((a,b)=>Number(recommendationEligible(b,now)&&rated(b)&&b.rating.value>=4)-Number(recommendationEligible(a,now)&&rated(a)&&a.rating.value>=4)||Number(recommendationEligible(b,now))-Number(recommendationEligible(a,now))||byRating(a,b));
}
// Savings are only computed for an identical, explicitly quantified manufacturer article.
export function cheaperIdentical(row,rows){
 if(row.price===null||!row.quantity||!key(row.manufacturer)||!key(row.sku))return null;
 return rows.filter(other=>other.url!==row.url&&other.kind==="product"&&other.price!==null&&other.price<row.price&&
  other.quantity===row.quantity&&other.itemCondition===row.itemCondition&&key(other.manufacturer)===key(row.manufacturer)&&key(other.sku)===key(row.sku))
  .sort(byPrice)[0]||null;
}

export const completeOffer=row=>row.kind==="product"&&row.price!==null&&row.price>0&&!!row.image;
