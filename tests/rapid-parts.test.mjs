import {test} from "node:test";
import assert from "node:assert/strict";
import {JsonBodyError, readJson} from "../supabase/functions/_shared/read-json.mjs";
import {lookupRapidParts, rapidPartsForVehicle, rapidQuery, rapidReferences} from "../supabase/functions/live-web-search/rapid-parts.mjs";

const golf = {make: "Volkswagen", model: "Golf", engine: "Golf VII 2.0 TDI 150 PS (CRBC)", year: 2019, series: "Golf VII"};
const query = {model: "Golf", engine: "2.0 TDI", year: "2019", category: "rear brake pads"};

test("requests use the documented fields and translate the selected axle", () => {
  assert.deepEqual(rapidQuery(golf, "Bremsbeläge hinten", "Bremsbeläge"), query);
  assert.equal(rapidQuery({...golf, engine: ""}, "Bremsbeläge", "Bremsbeläge"), null);
  assert.equal(rapidQuery(golf, "freie Eingabe", ""), null);
});

test("only matching part categories and positions are kept, with no inferred currency", () => {
  const data = [
    {ref: "Test 1234", type: "Rear brake pads", price: "32.10", source: "https://www.mister-auto.de/"},
    {ref: "Test 4321", type: "Front brake pad", price: "20.10"},
    {ref: "Test 9999", type: "oil filter", price: "11.00"}
  ];
  assert.deepEqual(rapidReferences(data, "Bremsbeläge", "Bremsbeläge hinten"), [{
    reference: "Test 1234", type: "Rear brake pads", price: 32.1, currency: null,
    url: "https://www.mister-auto.de/", image: ""
  }]);
});

test("a vendor subscription denial is reported without returning its response", async () => {
  const output = await lookupRapidParts(query, "Bremsbeläge", "Bremsbeläge hinten", "test-key", async (url, options) => {
    assert.equal(url, "https://auto-parts-finder1.p.rapidapi.com/get_parts");
    assert.equal(options.headers["x-rapidapi-key"], "test-key");
    assert.equal(options.redirect, "manual");
    assert.deepEqual(JSON.parse(options.body), query);
    return Response.json({message: "You are not subscribed to this API."}, {status: 403});
  });
  assert.deepEqual(output, {status: "access", parts: [], http: 403});
});

test("the live compatible_parts envelope is parsed and bare merchant domains are linked", async () => {
  const result = await lookupRapidParts(query, "Bremsbeläge", "Bremsbeläge hinten", "test-key",
    async () => Response.json({compatible_parts: [
      {ref: "trw gdb2138", type: "brake pad", price: "25.00", source: "auto-doc.fr"}
    ]}));
  assert.deepEqual(result, {status: "ready", parts: [
    {reference: "trw gdb2138", type: "brake pad", price: 25, currency: null,
      url: "https://auto-doc.fr/", image: ""}
  ]});
  assert.deepEqual(rapidPartsForVehicle(result.parts, golf, "Bremsbeläge", []), []);
});

test("a RapidAPI error in a successful HTTP envelope preserves the access status", async () => {
  const result = await lookupRapidParts(query, "Bremsbeläge", "Bremsbeläge hinten", "test-key",
    async () => new Response('{"message":"You are not subscribed to this API."}', {status: 200}));
  assert.deepEqual(result, {status: "access", parts: [], http: 200});
});

test("the bounded JSON reader checks byte length and accepts UTF-8", async () => {
  assert.deepEqual(await readJson(Response.json({word: "Ölfilter"}), 100), {word: "Ölfilter"});
  await assert.rejects(readJson(Response.json({word: "Ölfilter"}), 6),
    error => error instanceof JsonBodyError && error.status === 413);
  await assert.rejects(readJson(new Response("description"), 100),
    error => error instanceof JsonBodyError && error.status === 415);
});
