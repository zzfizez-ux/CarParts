import {test} from "node:test";
import assert from "node:assert/strict";
import {offerObservations} from "../supabase/functions/live-web-search/offer-observations.mjs";

const product={part_id:42,evidence:"manufacturer",merchant:"Example shop",price:61.99,currency:"EUR",
  url:"https://shop.example/brembo/09-b570-11",image:"https://media.example/09-b570-11.webp",
  observed_at:"2026-11-23T07:00:00Z"};

test("only observations for a sourced manufacturer article are eligible for persistence",()=>{
  assert.equal(offerObservations([product]).length,1);
  assert.deepEqual(offerObservations([{...product,evidence:"merchant"},{...product,part_id:undefined}]),[]);
});
test("merchant image observations reject unsafe URLs and unpriced or undated records",()=>{
  for (const change of [{image:"javascript:alert(1)"},{url:"https://secret@shop.example/item"},
    {price:NaN},{price:-1},{currency:""},{observed_at:"invalid"}]) {
    assert.deepEqual(offerObservations([{...product,...change}]),[]);
  }
});
test("the newest observation wins for the same article and merchant product",()=>{
  const newer={...product,price:62.50,observed_at:"2026-11-23T08:00:00Z"};
  const [row]=offerObservations([newer,product]);
  assert.equal(row.price_amount,62.50);
  assert.equal(row.image_url,product.image);
  assert.equal(row.source_url,product.url);
});
