import {googleProductLink} from "./product-link.mjs";
import {money} from "./offer-facts.mjs";
import {hasPartNumber,matchesPartText,seriesEvidence,words} from "./vehicle-fitment.mjs";
import {researchSourceUrl,safeSourceUrl} from "./search-providers.mjs";
import {requestedProduct} from "./product-kind.mjs";

export function shoppingQuery(vehicle,term,applications=[],details={}){
 const reference=details.oe_number||applications.find(part=>part.oe?.length)?.oe[0];
 if(reference)return [term,reference,vehicle.make,vehicle.model].filter(Boolean).join(" ");
 const series=String(vehicle.series||vehicle.model||"");
 const engine=String(vehicle.engine||"").split(/\s+[–—]\s+|\s+-\s+/)[0].replace(series,"").trim().split(/\s+/).slice(0,2).join(" ");
 return [term,vehicle.make,series,engine].filter(Boolean).join(" ");
}
export function shoppingPrice(raw){
 if(typeof raw!=="string"||!/(€|\bEUR\b)/i.test(raw)||/ab |from |\/|monat|month|rate|–|—/i.test(raw))return null;
 const value=raw.replace(/EUR|€/gi,"").trim();
 if(!/^[\d.,\s\u00a0]+$/.test(value))return null;
 const amount=money(value);return amount!==null&&amount>0?amount:null;
}
export function shoppingProducts(rows,vehicle,term,category,applications=[],details={},checked=new Date()){
 const products=new Map();
 for(const row of Array.isArray(rows)?rows.slice(0,40):[]){
  if(/\bebay\b/i.test(String(row.source||"")+" "+String(row.title||"")))continue;
  const googleLink=googleProductLink(row.link,row.productId);
  const url=researchSourceUrl(row.link)||(googleLink?new URL(googleLink):null),image=safeSourceUrl(row.imageUrl),price=shoppingPrice(row.price);
  const name=typeof row.title==="string"?row.title.trim().slice(0,200):"";
  if(!url||!image||price===null||!name||!requestedProduct(name,term,category)||!matchesPartText(name,term,category))continue;
  const identity=[name,decodeURI(url.pathname)].join(" ");
  const evidence=seriesEvidence(vehicle,identity);if(evidence==="conflict")continue;
  const article=applications.find(part=>hasPartNumber(identity,part.manufacturer_part_number)&&
    words(name).startsWith(words(part.manufacturer)+" "));
  const knownOE=applications.flatMap(part=>part.oe||[]);
  const listedOE=identity.match(/\b\d[A-Z0-9]{2}[ ._-]?\d{3}[ ._-]?\d{3}[A-Z]{0,3}\b/gi)||[];
  if(/volkswagen|audi|seat|skoda/.test(words(vehicle.make))&&knownOE.length&&listedOE.length&&!knownOE.some(number=>hasPartNumber(identity,number)))continue;
  const originalBrand=/^(?:original vw|vw original|volkswagen original|original volkswagen)\b/.test(words(name));
  const referenceArticle=!article&&originalBrand?applications.find(part=>(part.oe||[]).some(number=>hasPartNumber(identity,number))):undefined;
  const referenceNumber=referenceArticle?.oe.find(number=>hasPartNumber(identity,number));
  const byReference=!!details.oe_number;
  const model=words(vehicle.model),text=words(identity);
  if(!article&&evidence!=="match"&&!byReference&&!(" "+text+" ").includes(" "+model+" "))continue;
  const rating=typeof row.rating==="number"&&row.rating>=1&&row.rating<=5&&Number.isInteger(row.ratingCount)&&row.ratingCount>0
    ? {value:row.rating,best:5,worst:1,count:row.ratingCount}:null;
  const merchant=typeof row.source==="string"&&row.source.trim()?row.source.trim().slice(0,120):url.hostname;
  const item={name,description:typeof row.snippet==="string"?row.snippet.slice(0,1400):name,
   price,currency:"EUR",image:image.href,url:url.href,merchant,manufacturer:article?.manufacturer||(referenceArticle?"Volkswagen (laut Angebot)":""),sku:article?.manufacturer_part_number||referenceNumber||"",
   offer_link_type:url.hostname.endsWith("google.com")?"shopping":"merchant",part_id:article?.id,reference_part_id:referenceArticle?.id,source_url:article?.fitment?.source_url||article?.source_url||referenceArticle?.fitment?.source_url||referenceArticle?.source_url||"",evidence:"shopping",price_source:"Google Shopping via Serper",image_source:"Google Shopping",
   condition:article?.fitment?.notes||referenceArticle?.fitment?.notes||"Händlerangebot gefunden. Motor, Getriebe, Baujahr und genaue Ausführung mit dem Anbieter abgleichen.",
   facts:{rating,rating_source:"Google Shopping",pack_quantity:/^\d{1,3}\s*x\b/i.test(name)?Number(name.match(/^(\d{1,3})/)[1]):null,item_condition:/\b(gebraucht|used)\b/i.test(name)?"used":/\b(uberholt|refurbished)\b/.test(words(name))?"refurbished":"unknown",availability:"",shipping_price:null,shipping_currency:null,
    delivery_note:typeof row.delivery==="string"?row.delivery.slice(0,160):""},
   observed_at:checked.toISOString(),metadata_status:"complete"};
  if(!products.has(item.url))products.set(item.url,item);
  if(products.size>=20)break;
 }
 return [...products.values()];
}

export function combineProducts(products){
 const found=new Map();
 for(const item of products){
  const prior=found.get(item.url);
  if(!prior||prior.sku&&item.sku&&words(prior.sku)!==words(item.sku)){found.set(item.url,item);continue;}
  const ownPrice=Number.isFinite(item.price)&&item.price>0;
  const rating=item.facts?.rating||prior.facts?.rating||null;
  const merged={...prior,...item,price:ownPrice?item.price:prior.price,currency:ownPrice?item.currency:prior.currency,
   image:item.image||prior.image,manufacturer:item.manufacturer||prior.manufacturer,
   price_source:ownPrice?item.price_source||"":prior.price_source||"",image_source:item.image?item.image_source||"":prior.image_source||"",
   facts:{...prior.facts,...item.facts,rating,rating_source:item.facts?.rating?item.facts.rating_source||"Händler":prior.facts?.rating_source||""}};
  merged.metadata_status=merged.price!==null&&merged.image?"complete":merged.price!==null?"price_only":merged.image?"image_only":"identity_only";
  found.set(item.url,merged);
 }
 return [...found.values()];
}
