import {test} from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {renderOfferComparison} from "../offer-comparison-ui.js";
function setup(){const {document}=parseHTML('<html><body><section id="comparison" hidden></section></body></html>');globalThis.document=document;return document.getElementById("comparison");}
const product={url:"https://levoil.de/filter",name:'Ölfilter <script>alert(1)</script>',description:"Herstellerbeschreibung",price:12.9,currency:"EUR",observed_at:"2026-11-27T11:00:00Z",fitment_status:"application_found",image:"https://levoil.de/item.jpg"};
test("comparison shows real prices, missing facts, recommendations and safe descriptive cards",()=>{
 const container=setup();renderOfferComparison(container,{products:[product],sources:[{url:"https://www.autodoc.de/category",title:"Thermostat-Kategorie",snippet:"Baureihe"}]},{now:Date.parse("2026-11-27T12:00:00Z")});
 assert.equal(container.hidden,false);assert.equal(container.querySelectorAll(".comparison-card").length,2);assert.equal(container.querySelector("script"),null);
 assert.ok(container.textContent.includes("12,90"));assert.ok(container.textContent.includes("Preis nicht verfügbar"));assert.ok(container.textContent.includes("Kein Produktbild verfügbar"));assert.ok(container.textContent.includes("Keine belegten Produktbewertungen"));assert.ok(container.textContent.includes("kein unabhängiger")||container.textContent.includes("keine Haltbarkeit"));
 const img=container.querySelector("img");img.dispatchEvent(new document.defaultView.Event("error"));assert.ok(!container.querySelector("img"));assert.ok(container.querySelector(".comparison-no-photo"));
 assert.ok([...container.querySelectorAll("a")].every(link=>link.rel==="noopener noreferrer"));
});
test("local sorting and filtering work without a network request; clearing removes old car data",()=>{
 const container=setup();let requests=0;globalThis.fetch=()=>{requests++;throw new Error("must stay local");};
 renderOfferComparison(container,{products:[product,{...product,url:"https://levoil.de/cheap",name:"Günstiger",price:7}],sources:[{url:"https://www.autodoc.de/category"}]});
 const select=container.querySelector("select");Object.defineProperty(select,"value",{value:"price",configurable:true});select.onchange();assert.ok(container.querySelector(".comparison-card").textContent.includes("Günstiger"));
 const filter=container.querySelector('input[type="checkbox"]');filter.checked=true;filter.onchange();assert.equal(container.querySelectorAll(".comparison-card").length,2);assert.equal(requests,0);
 renderOfferComparison(container,{});assert.equal(container.hidden,true);assert.equal(container.childElementCount,0);
});
