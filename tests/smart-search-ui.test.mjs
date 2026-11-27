import {test} from "node:test";
import assert from "node:assert/strict";
import {parseHTML} from "linkedom";
import {bindPartSearchHints,renderQueryUnderstanding} from "../smart-search-ui.js";
import {understandPartQuery} from "../supabase/functions/live-web-search/part-search.mjs";
function setup(){const {document,window}=parseHTML('<html><body><input id="search"><section id="hints" hidden></section><section id="result" hidden></section></body></html>');globalThis.document=document;return {document,window,input:document.getElementById("search"),hints:document.getElementById("hints"),result:document.getElementById("result")};}
test("real clarification buttons select a component and original search remains available",()=>{
 const ui=setup();let chosen,literal=0;
 renderQueryUnderstanding(ui.result,understandPartQuery("Kupplung Steuergerät"),item=>{chosen=item;},{onLiteral:()=>literal++});
 assert.equal(ui.result.hidden,false);assert.equal(ui.result.querySelectorAll(".smart-search-choice").length,3);
 assert.ok(ui.result.textContent.includes("Betätigung der Kupplung"));
 ui.result.querySelectorAll(".smart-search-choice")[2].onclick();assert.equal(chosen.query,"Kupplungsaktuator");
 ui.result.querySelector(".smart-search-literal").onclick();assert.equal(literal,1);
 renderQueryUnderstanding(ui.result,understandPartQuery("Ölfilter"),()=>{});assert.equal(ui.result.hidden,true);
});
test("typing suggestions make no request, respect composition and preserve position in a clicked correction",()=>{
 const ui=setup();let chosen,requests=0;globalThis.fetch=()=>{requests++;throw new Error("No typing network calls");};
 const hints=bindPartSearchHints(ui.input,ui.hints,item=>chosen=item);
 ui.input.value="bremsbelege hinten links";ui.input.dispatchEvent(new ui.window.Event("input"));
 assert.equal(ui.hints.hidden,false);assert.equal(ui.input.getAttribute("aria-describedby"),"hints");
 ui.hints.querySelector("button").onclick();assert.equal(chosen.query,"Bremsbeläge hinten links");assert.equal(requests,0);
 ui.input.dispatchEvent(new ui.window.Event("compositionstart"));ui.input.value="";ui.input.dispatchEvent(new ui.window.Event("input"));assert.equal(ui.hints.hidden,false);
 ui.input.dispatchEvent(new ui.window.Event("compositionend"));assert.equal(ui.hints.hidden,true);
 hints.clear();assert.equal(ui.hints.childElementCount,0);
});
test("original input and descriptions are displayed as text without executing markup",()=>{
 const ui=setup();renderQueryUnderstanding(ui.result,{status:"corrected",original:'<img src=x onerror="alert(1)">',message:"Ölfilter",suggestions:[{label:"<script>bad()</script>",query:"Ölfilter",description:"<b>Text</b>"}]},()=>{});
 assert.equal(ui.result.querySelector("script"),null);assert.equal(ui.result.querySelector("img"),null);assert.ok(ui.result.textContent.includes("<b>Text</b>"));
});
