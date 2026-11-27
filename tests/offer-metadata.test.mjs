import {test} from "node:test";
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,next){return next(specifier==="npm:linkedom@0.18.12"?"linkedom":specifier,context);}});
import {money,offerFacts,productRating} from "../supabase/functions/live-web-search/offer-facts.mjs";
const {offersFromWeb}=await import("../supabase/functions/live-web-search/offers.ts");
const vehicle={make:"Volkswagen",model:"Golf",series:"Golf VII",engine:"2.0 TDI",year:2015,variant:""};
const base={"@type":"Product",name:"MANN-FILTER Ölfilter Golf VII HU 7020 z",brand:"MANN-FILTER",mpn:"HU 7020 z",image:"https://levoil.de/filter.jpg",offers:{price:"12.90",priceCurrency:"EUR",itemCondition:"https://schema.org/NewCondition"}};
function stub(products){globalThis.fetch=async()=>new Response('<html><h1>Ölfilter</h1><script type="application/ld+json">'+JSON.stringify(products)+'</script></html>',{headers:{"content-type":"text/html"}});}
async function read(p){stub(p);return (await offersFromWeb([{url:"https://levoil.de/filter",title:base.name}],vehicle,"Ölfilter","Ölfilter")).products;}
test("retailer extraction keeps price-only, image-only and identity-only products",async()=>{
 let rows=await read({...base,image:undefined});assert.equal(rows.length,1);assert.equal(rows[0].price,12.9);assert.equal(rows[0].image,"");assert.equal(rows[0].metadata_status,"price_only");
 rows=await read({...base,offers:undefined});assert.equal(rows[0].price,null);assert.equal(rows[0].metadata_status,"image_only");
 rows=await read({...base,offers:undefined,image:undefined});assert.equal(rows[0].price,null);assert.equal(rows[0].metadata_status,"identity_only");
 rows=await read({...base,offers:{price:12.9,priceCurrency:"USD"}});assert.equal(rows[0].price,null);
});
test("category pages and ambiguous multi-product pages cannot supply an arbitrary product price",async()=>{
 assert.deepEqual(await read({"@type":"ItemList",name:"Ölfilter Golf VII",lowPrice:1}),[]);
 assert.deepEqual(await read([base,{...base,name:"Other Ölfilter Golf VII",mpn:"OTHER"}]),[]);
 assert.deepEqual(await read({...base,name:"Ölfilter BMW F30 HU 7020 z"}),[]);
});
test("only explicit product-scoped ratings, pack quantities and unconditional DE shipping are exposed",()=>{
 const item={...base,aggregateRating:{ratingValue:"4.6",reviewCount:"18"},additionalProperty:{name:"Stückzahl",value:"2"}};
 const offer={...base.offers,shippingDetails:{shippingDestination:{addressCountry:"DE"},shippingRate:{value:"4.90",currency:"EUR"}}};
 const facts=offerFacts(item,offer);assert.deepEqual(facts.rating,{value:4.6,best:5,worst:1,count:18});assert.equal(facts.pack_quantity,2);assert.equal(facts.shipping_price,4.9);assert.equal(facts.item_condition,"new");
 assert.equal(offerFacts(item,{shippingDetails:[offer.shippingDetails,offer.shippingDetails]}).shipping_price,null);
 assert.equal(offerFacts(item,{shippingDetails:{...offer.shippingDetails,freeShippingThreshold:50}}).shipping_price,null);
 assert.equal(offerFacts(item,{shippingDetails:{...offer.shippingDetails,doesNotShip:true}}).shipping_price,null);
 assert.equal(offerFacts(item,{shippingDetails:{...offer.shippingDetails,shippingDestination:{addressCountry:"DE",addressRegion:"Berlin"}}}).shipping_price,null);
 assert.equal(offerFacts(item,{shippingDetails:{...offer.shippingDetails,shippingDestination:{addressCountry:"AT"}}}).shipping_price,null);
 assert.equal(offerFacts({...item,additionalProperty:{name:"Stückzahl",value:"2er Satz"}},offer).pack_quantity,null);
 for(const aggregateRating of [{ratingValue:6,reviewCount:5},{ratingValue:5,reviewCount:0},{ratingValue:4,reviewCount:1.5},{ratingValue:5,reviewCount:10,itemReviewed:{"@type":"Organization",name:base.name}},{ratingValue:5,reviewCount:10,itemReviewed:{name:"Shopbewertungen"}}])assert.equal(productRating({...base,aggregateRating}),null);
});
test("prices reject missing, non-numeric, negative and over-precision values",()=>{
 for(const value of [null,undefined,"",-1,"ab 12,90 €","NaN","1.234",1.234])assert.equal(money(value),null);
 assert.equal(money("12,90"),12.9);assert.equal(money("1.234,56"),1234.56);assert.equal(money(0),0);
});


test("different variant offer prices do not become an arbitrary headline price",async()=>{
 const rows=await read({...base,offers:[{price:10,priceCurrency:"EUR",url:"https://levoil.de/variant-a"},{price:20,priceCurrency:"EUR",url:"https://levoil.de/variant-b"}]});
 assert.equal(rows[0].price,null);
 const matched=await read({...base,offers:[{price:10,priceCurrency:"EUR",url:"https://levoil.de/variant-a"},{price:20,priceCurrency:"EUR",url:"https://levoil.de/filter"}]});
 assert.equal(matched[0].price,20);
});

test("a category resolves bounded product links and excludes connector accessories before following them",async()=>{
 const calls=[];globalThis.fetch=async raw=>{
  const url=String(raw);calls.push(url);
  if(url.endsWith('/category'))return new Response('<html><title>Steuergerät BMW E92</title><h1>Getriebesteuergerät BMW E92</h1><script type="application/ld+json">'+JSON.stringify({'@type':'ItemList',itemListElement:[{item:{name:'Steckgehäuse Automatikgetriebe-Steuereinheit',url:'https://www.pkwteile.de/aic/123'}},{item:{name:'Getriebesteuergerät',url:'https://www.pkwteile.de/bosch/456'}}]})+'</script></html>',{headers:{'content-type':'text/html'}});
  return new Response('<html><script type="application/ld+json">'+JSON.stringify({...base,name:'Getriebesteuergerät',url,brand:'BOSCH',mpn:'TCU123',image:'https://www.pkwteile.de/tcu.jpg',offers:{price:699,priceCurrency:'EUR'}})+'</script></html>',{headers:{'content-type':'text/html'}});
 };
 const result=await offersFromWeb([{url:'https://www.pkwteile.de/category'}],{make:'BMW',model:'3er',series:'E92',year:2011,engine:'335i',variant:''},'Getriebesteuergerät','Getriebesteuergerät');
 assert.equal(result.products.length,1);assert.equal(result.products[0].price,699);assert.equal(result.products[0].url,'https://www.pkwteile.de/bosch/456');assert.ok(!calls.some(url=>url.includes('/aic/')));
});
