import {test} from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {renderOfferComparison} from "../offer-comparison-ui.js";
function setup(){const {document}=parseHTML('<html><body><section id="comparison" hidden></section></body></html>');globalThis.document=document;return document.getElementById("comparison");}
const product={url:"https://levoil.de/filter",name:'Ölfilter <script>alert(1)</script>',merchant:"levoil",manufacturer:"MANN-FILTER",description:"Herstellerbeschreibung",price:12.9,currency:"EUR",observed_at:"2026-11-27T11:00:00Z",fitment_status:"application_found",image:"https://levoil.de/item.jpg"};
const now=Date.parse("2026-11-27T12:00:00Z");
test("only complete product offers have large cards; source/category links stay available in a closed section",()=>{
 const container=setup();renderOfferComparison(container,{products:[product,{...product,url:"https://levoil.de/missing-photo",image:""}],sources:[{url:"https://www.autodoc.de/category",title:"Thermostat-Kategorie",snippet:"Baureihe"}]},{now});
 assert.equal(container.hidden,false);assert.equal(container.querySelectorAll(".comparison-card").length,1);assert.equal(container.querySelector("script"),null);
 const extra=container.querySelector(".comparison-incomplete");assert.equal(extra.hasAttribute("open"),false);assert.equal(extra.querySelectorAll("li").length,2);
 assert.ok(container.textContent.includes("12,90"));assert.ok(!container.querySelector(".comparison-grid").textContent.includes("Preis nicht verfügbar"));assert.ok(!container.querySelector(".comparison-grid").textContent.includes("Kein Produktbild"));
 assert.ok([...container.querySelectorAll("a")].every(link=>link.rel==="noopener noreferrer"));
});
test("a failed product image removes its offer from the comparison and from recommendations",()=>{
 const container=setup();const state=renderOfferComparison(container,{products:[{...product,facts:{rating:{value:4.8,best:5,worst:1,count:40}}}]},{now});
 assert.ok(container.querySelector(".comparison-recommended-badge"));
 container.querySelector(".comparison-card img").dispatchEvent(new document.defaultView.Event("error"));
 assert.equal(container.querySelectorAll(".comparison-card").length,0);assert.equal(state.offers.length,0);assert.equal(container.querySelector(".comparison-recommended-badge"),null);assert.ok(container.querySelector(".comparison-incomplete").textContent.includes("nicht abrufbar"));
});
test("local sorting and merchant filtering work without another search request",()=>{
 const container=setup();let requests=0;globalThis.fetch=()=>{requests++;throw new Error("must stay local");};
 renderOfferComparison(container,{products:[product,{...product,url:"https://levoil.de/cheap",name:"Günstiger",merchant:"Anderer Händler",price:7}],sources:[{url:"https://www.autodoc.de/category"}]},{now});
 let select=container.querySelector('[aria-label="Angebote sortieren"]');Object.defineProperty(select,"value",{value:"price",configurable:true});select.onchange();assert.ok(container.querySelector(".comparison-card").textContent.includes("Günstiger"));
 select=container.querySelector('[aria-label="Händler filtern"]');Object.defineProperty(select,"value",{value:"levoil",configurable:true});select.onchange();assert.equal(container.querySelectorAll(".comparison-card").length,1);assert.equal(requests,0);
 renderOfferComparison(container,{});assert.equal(container.hidden,true);assert.equal(container.childElementCount,0);
});
test("Empfohlen is shown with evidence and never awarded to the cheapest item or an unconfirmed fitment",()=>{
 const container=setup();renderOfferComparison(container,{products:[{...product,price:1},{...product,url:"https://levoil.de/quality",name:"Belegtes Produkt",price:20,facts:{rating:{value:4.7,best:5,worst:1,count:85}}}]},{now});
 const featured=container.querySelector(".comparison-featured");assert.ok(featured.textContent.includes("Empfohlen"));assert.ok(featured.textContent.includes("Belegtes Produkt"));assert.ok(featured.textContent.includes("85 Produktbewertungen"));assert.ok(featured.textContent.includes("Warum empfohlen"));
 renderOfferComparison(container,{products:[{...product,fitment_status:"unconfirmed",facts:{rating:{value:5,best:5,worst:1,count:100}}}]},{now});assert.equal(container.querySelector(".comparison-recommended-badge"),null);assert.ok(container.querySelector(".comparison-featured-empty"));
});
