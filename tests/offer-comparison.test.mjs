import {test} from "node:test";
import assert from "node:assert/strict";
import {buildComparison,comparisonRecommendations,recommendationEligible,sortComparison,cheaperIdentical} from "../offer-comparison.js";
const now=Date.parse("2026-11-27T12:00:00Z");
const product={url:"https://levoil.de/item/",name:"MANN Ölfilter",price:10,currency:"EUR",manufacturer:"MANN-FILTER",sku:"HU 7020 z",image:"https://levoil.de/item.jpg",observed_at:"2026-11-27T11:00:00Z",fitment_status:"application_found",facts:{item_condition:"new",rating:{value:4.8,best:5,worst:1,count:20},pack_quantity:1,shipping_price:4.9,shipping_currency:"EUR"}};
const row=(value={})=>buildComparison({products:[{...product,...value}]})[0];
test("partial product facts and every safe source survive without inventing zero prices or photos",()=>{
 const rows=buildComparison({products:[{...product,price:null,image:""}],sources:[{url:product.url+"#reviews",title:"duplicate"},{url:"https://www.autodoc.de/category",title:"Kategorie",price:1,image:"https://example.org/category.jpg"},{url:"javascript:alert(1)"},{url:"https://example.org:8443/product"},{url:"https://name:password@example.org/product"},{url:"https://www.ebay.de/itm/1"}]});
 assert.equal(rows.length,2);assert.equal(rows[0].price,null);assert.equal(rows[0].image,"");assert.equal(rows[1].kind,"source");assert.equal(rows[1].price,null);assert.equal(rows[1].image,"");
 assert.equal(comparisonRecommendations(rows,now).price,null);
});
test("fresh retailer responses replace stale stored prices, even when a price is withdrawn",()=>{
 const catalogue=[{id:1,manufacturer:"MANN-FILTER",part_name:"Ölfilter",manufacturer_part_number:"HU 7020 z",assessment:{status:"application_found"},offers:[{product_url:product.url,price_amount:"5.00",currency:"EUR",observed_at:"2026-11-26T11:00:00Z"}]}];
 const rows=buildComparison({catalogue,products:[product],sources:[{url:product.url,title:"Source"}]});assert.equal(rows.length,1);assert.equal(rows[0].price,10);
 assert.equal(buildComparison({catalogue,products:[{...product,price:null}]})[0].price,null);
});
test("price, rating and combined recommendations use distinct documented rules",()=>{
 const rows=buildComparison({products:[{...product,url:"https://levoil.de/cheap",price:8,facts:{}},product,{...product,url:"https://levoil.de/value",price:9,facts:{rating:{value:4.2,best:5,worst:1,count:7}}},{...product,url:"https://levoil.de/one-review",price:1,facts:{rating:{value:5,best:5,worst:1,count:1}}}]});
 const tips=comparisonRecommendations(rows,now);assert.equal(tips.price.price,1);assert.equal(tips.quality.price,10);assert.equal(tips.value.price,9);
 assert.equal(sortComparison(rows,"rating",now)[0].price,10);assert.equal(sortComparison(rows,"value",now)[0].price,9);
 const noRating=buildComparison({products:[{...product,facts:{}}]});assert.equal(comparisonRecommendations(noRating,now).quality,null);assert.equal(comparisonRecommendations(noRating,now).value,null);
});
test("unconfirmed fitment, open constraints, old prices and unavailable products never get tips",()=>{
 for(const value of [{fitment_status:"unconfirmed"},{fitment_unresolved:["equipment_code"]},{fitment_conflicts:["engine_unconfirmed"]},{observed_at:"2026-11-25T12:00:00Z"},{observed_at:""},{facts:{availability:"OutOfStock"}},{facts:{item_condition:"used"}},{price:0},{currency:"USD"}])assert.equal(recommendationEligible(row(value),now),false,JSON.stringify(value));
 assert.equal(recommendationEligible(row(),now),true);
 assert.equal(comparisonRecommendations([row({fitment_status:"unconfirmed"})],now).quality,null);
});
test("unknown prices and unknown delivered totals sort last; foreign currencies are not converted",()=>{
 const rows=[row({price:null}),row({url:"https://levoil.de/known",price:20}),row({url:"https://levoil.de/free",price:15,facts:{shipping_price:0,shipping_currency:"EUR"}}),row({url:"https://levoil.de/usd",price:1,currency:"USD"})];
 assert.equal(sortComparison(rows,"price")[0].price,15);assert.equal(sortComparison(rows,"price").at(-1).price,null);assert.equal(sortComparison(rows,"total")[0].total,15);assert.equal(rows[0].total,null);
});
test("cheaper alternatives require identical manufacturer, article, explicit quantity and condition",()=>{
 const expensive=row({price:20}),cheap=row({url:"https://levoil.de/cheap",price:10});assert.equal(cheaperIdentical(expensive,[cheap])?.price,10);
 for(const candidate of [row({price:1,facts:{pack_quantity:2,item_condition:"new"}}),row({price:1,facts:{item_condition:"new"}}),row({price:1,manufacturer:"Other"}),row({price:1,sku:"OTHER"}),row({price:1,facts:{pack_quantity:1,item_condition:"used"}})])assert.equal(cheaperIdentical(expensive,[candidate]),null);
});


test("a newer saved price preserves recent rich product facts with a separate timestamp",()=>{
 const catalogue=[{manufacturer:"MANN-FILTER",part_name:"Ölfilter",manufacturer_part_number:"HU 7020 z",assessment:{status:"application_found",unresolved:[]},offers:[{product_url:product.url,price_amount:"11.00",currency:"EUR",observed_at:"2026-11-27T11:02:00Z"}]}];
 const result=buildComparison({catalogue,products:[{...product,description:"Echte ausführliche Produktbeschreibung"}]})[0];
 assert.equal(result.price,11);assert.equal(result.total,15.9);assert.equal(result.shipping,4.9);assert.equal(result.rating.count,20);assert.equal(result.description,"Echte ausführliche Produktbeschreibung");assert.equal(result.observedAt,"2026-11-27T11:02:00Z");assert.equal(result.factsAt,product.observed_at);
 const stale=buildComparison({catalogue,products:[{...product,observed_at:"2026-11-27T09:00:00Z"}]})[0];assert.equal(stale.shipping,null);assert.equal(stale.rating,null);
});
