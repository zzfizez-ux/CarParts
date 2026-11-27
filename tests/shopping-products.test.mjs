import {test} from "node:test";
import assert from "node:assert/strict";
import {shoppingPrice,shoppingProducts,combineProducts} from "../supabase/functions/live-web-search/shopping-products.mjs";
import {lookupShopping} from "../supabase/functions/live-web-search/search-providers.mjs";
import {requestedProduct} from "../supabase/functions/live-web-search/product-kind.mjs";
const vehicle={make:"BMW",model:"3er",series:"E92",year:2011,engine:"335i xDrive 3.0",variant:""};
const raw={title:"Getriebesteuergerät BMW E92 335i xDrive",link:"https://www.shop-example.de/tcu",source:"Händler A",price:"699,90 €",imageUrl:"https://encrypted-tbn0.gstatic.com/shopping?sample=1",rating:4.8,ratingCount:40};
test("Shopping uses the existing secret and one standard German provider request",async()=>{
 let calls=0;const result=await lookupShopping("Getriebesteuergerät BMW E92","private-test",async(url,options)=>{
  calls++;assert.equal(url,"https://google.serper.dev/shopping");assert.equal(options.headers["X-API-KEY"],"private-test");assert.deepEqual(JSON.parse(options.body),{q:"Getriebesteuergerät BMW E92",gl:"de",hl:"de",num:20});return Response.json({shopping:[raw]});
 });assert.equal(calls,1);assert.equal(result.results.length,1);assert.ok(!JSON.stringify(result).includes("private-test"));
});
test("only actual EUR prices are parsed; ranges, financing and missing values are not prices",()=>{
 assert.equal(shoppingPrice("1.234,56 €"),1234.56);assert.equal(shoppingPrice("€ 12.90"),12.9);assert.equal(shoppingPrice("EUR 12,90"),12.9);
 for(const value of ["ab 10 €","10 € / Monat","$10","10 - 20 €","gratis",null,"0,00 €"])assert.equal(shoppingPrice(value),null,value);
});
test("Shopping creates individual priced, imaged offers with review attribution and deduplicates URLs",()=>{
 const result=shoppingProducts([raw,raw],vehicle,"Getriebesteuergerät","Getriebesteuergerät");assert.equal(result.length,1);assert.equal(result[0].price,699.9);assert.equal(result[0].evidence,"shopping");assert.equal(result[0].facts.rating.count,40);assert.equal(result[0].facts.rating_source,"Google Shopping");assert.equal(result[0].part_id,undefined);
 for(const value of [{...raw,imageUrl:""},{...raw,price:""},{...raw,link:"https://www.ebay.de/itm/123"},{...raw,link:"https://www.google.com/shopping/product/123"},{...raw,title:"Getriebesteuergerät Mercedes W222"}])assert.deepEqual(shoppingProducts([value],vehicle,"Getriebesteuergerät","Getriebesteuergerät"),[]);
});
test("connector housings, seals, repair tools and repair services are not sold as a full control unit",()=>{
 for(const name of ["Steckgehäuse Automatikgetriebe-Steuereinheit BMW E92","Dichthülsen Getriebesteuergerät BMW E92","T-Griff Werkzeug Mechatronik BMW E92","Reparaturservice Getriebesteuergerät BMW E92"]){assert.equal(requestedProduct(name,"Getriebesteuergerät","Getriebesteuergerät"),false,name);assert.equal(shoppingProducts([{...raw,title:name}],vehicle,"Getriebesteuergerät","Getriebesteuergerät").length,0);}
 assert.equal(requestedProduct(raw.title,"Getriebesteuergerät","Getriebesteuergerät"),true);
});
test("fresh merchant facts retain same-product Shopping ratings and attribution",()=>{
 const shopping=shoppingProducts([raw],vehicle,"Getriebesteuergerät","Getriebesteuergerät")[0];
 const merged=combineProducts([shopping,{...shopping,evidence:"merchant",price:650,price_source:"",facts:{rating:null,item_condition:"new"}}])[0];
 assert.equal(merged.price,650);assert.equal(merged.facts.rating.count,40);assert.equal(merged.facts.rating_source,"Google Shopping");assert.equal(merged.price_source,"");
});


test("current Shopping responses without merchant links use their public product view with clear attribution",()=>{
 const rows=shoppingProducts([{...raw,link:undefined,productId:"1234567890123456789"}],vehicle,"Getriebesteuergerät","Getriebesteuergerät");
 assert.equal(rows.length,1);assert.equal(rows[0].url,"https://www.google.com/shopping/product/1234567890123456789");assert.equal(rows[0].offer_link_type,"shopping");
 assert.deepEqual(shoppingProducts([{...raw,source:"eBay",link:undefined,productId:"1234567890123456789"}],vehicle,"Getriebesteuergerät","Getriebesteuergerät"),[]);
});

test("an advertised original VW part can link an exact documented OE reference without becoming a MANN article",()=>{
 const car={make:"Volkswagen",model:"Golf",series:"Golf VII",year:2015,engine:"2.0 TDI",variant:""};
 const applications=[{id:24,manufacturer:"MANN-FILTER",manufacturer_part_number:"HU 7020 z",oe:["03N 115 562","03N 115 562 B"],fitment:{source_url:"https://www.mann-filter.com/verified"}}];
 const [item]=shoppingProducts([{...raw,title:"Original VW Ölfilter Golf 7 2.0 TDI 03N115562B"}],car,"Ölfilter","Ölfilter",applications);
 assert.equal(item.part_id,undefined);assert.equal(item.reference_part_id,24);assert.equal(item.manufacturer,"Volkswagen (laut Angebot)");assert.equal(item.sku,"03N 115 562 B");
 assert.deepEqual(shoppingProducts([{...raw,title:"06D115562OE VW Ölfilter Golf"}],car,"Ölfilter","Ölfilter",applications),[]);
});
