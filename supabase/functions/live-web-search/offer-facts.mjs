// Only product-scoped, explicit retailer facts enter the comparison.
export function money(value) {
  if (typeof value!=="number" && typeof value!=="string") return null;
  if (typeof value==="number") return Number.isFinite(value)&&value>=0&&Math.abs(value*100-Math.round(value*100))<0.000001?value:null;
  const raw=String(value).trim().replace(/[\s\u00a0]/g,"");
  const amount=/^\d+(\.\d{1,2})?$/.test(raw) ? Number(raw)
    : /^\d+(\.\d{3})*,\d{1,2}$/.test(raw) ? Number(raw.replaceAll(".","").replace(",",".")) : NaN;
  return Number.isFinite(amount)&&amount>=0 ? amount : null;
}
function numeric(value) {
  return (typeof value==="number" || typeof value==="string"&&/^\d+(?:\.\d+)?$/.test(value))&&Number.isFinite(Number(value))?Number(value):null;
}
export function productRating(item) {
  const rating=item?.aggregateRating;
  if(!rating||typeof rating!=="object"||Array.isArray(rating))return null;
  const reviewed=rating.itemReviewed;
  if(reviewed && typeof reviewed==="object"){
    if(reviewed["@type"] && ![reviewed["@type"]].flat().some(type=>type==="Product"||type==="https://schema.org/Product"))return null;
    if(reviewed.name && item.name && reviewed.name!==item.name)return null;
    if(reviewed.url && item.url && reviewed.url!==item.url)return null;
  }
  if(typeof reviewed==="string" && ![item.url,item["@id"]].includes(reviewed))return null;
  const value=numeric(rating.ratingValue),best=numeric(rating.bestRating??5),worst=numeric(rating.worstRating??1);
  const count=numeric(rating.reviewCount??rating.ratingCount);
  if(value===null||best===null||worst===null||best<=worst||value<worst||value>best||count===null||!Number.isInteger(count)||count<1)return null;
  return {value,best,worst,count};
}
export function offerFacts(item,offer={}) {
  const condition=String(offer.itemCondition||item?.itemCondition||"").split(/[\/#]/).at(-1);
  const item_condition={NewCondition:"new",UsedCondition:"used",RefurbishedCondition:"refurbished",DamagedCondition:"damaged"}[condition]||"unknown";
  const availability=String(offer.availability||"").split(/[\/#]/).at(-1);
  const properties=[item?.additionalProperty].flat().filter(Boolean);
  const quantityProperty=properties.find(p=>/^(verpackungseinheit|pack quantity|stuckzahl|stückzahl|anzahl pro packung)$/i.test(String(p?.name||"")));
  const rawQuantity=numeric(quantityProperty?.value??item?.numberOfItems);
  const pack_quantity=Number.isInteger(rawQuantity)&&rawQuantity>0&&rawQuantity<=1000?rawQuantity:null;
  const shipping=[offer.shippingDetails].flat().filter(Boolean);
  // A conditional threshold or an ambiguous rule cannot be treated as unconditional free shipping.
  const rule=shipping.length===1 ? shipping[0] : null;
  const destination=rule?.shippingDestination;
  const country=destination?.addressCountry;
  const de=country==="DE"||Array.isArray(country)&&country.includes("DE");
  const rate=rule?.shippingRate;
  const unconditional=rule && Object.keys(rule).every(key=>["@type","shippingDestination","shippingRate","deliveryTime","doesNotShip"].includes(key)) &&
    !rule.doesNotShip && destination && Object.keys(destination).every(key=>["@type","addressCountry"].includes(key)) &&
    rate && Object.keys(rate).every(key=>["@type","value","currency"].includes(key)) && !offer.eligibleTransactionVolume;
  const shipping_price=de&&unconditional&&rate.currency==="EUR"?money(rate.value):null;
  return {rating:productRating(item),pack_quantity,item_condition,availability,
    shipping_price,shipping_currency:shipping_price===null?null:"EUR"};
}
