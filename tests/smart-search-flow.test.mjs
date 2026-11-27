import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {understandPartQuery} from "../supabase/functions/live-web-search/part-search.mjs";
const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const code=app.slice(app.indexOf("async function search(options={})"),app.indexOf("function clearEngine()"));
function setup(query){
 const elements=new Map([["partSearch",{value:query}],["vin",{value:""}]]);
 const $=id=>{if(!elements.has(id))elements.set(id,{hidden:false,clearCount:0,replaceChildren(){this.clearCount++;},scrollIntoView(){}});return elements.get(id);};
 const context={$,understandPartQuery,state:{vehicle:{make:"Volkswagen",model:"Golf",series:"Golf VII"}},window:{CarPartsVIN:{check:()=>({vin:""})},CarPartsDB:{diagnosticCode:()=>false}},vinResult:{status:"idle"},catalogRequest:0,skipPreflight:false,
  choosePartSuggestion(){},vehicleLabel:()=>"Golf VII",literalSearch:false,partSearchHints:{clear(){}},clearOfferComparison(){context.clearCount++;},clearCount:0,show(){},setCatalogStatus(){},interpreted:null,
  renderQueryUnderstanding:(container,result)=>context.interpreted=result,calls:[]};
 context.renderLiveResults=async term=>{context.catalogRequest++;context.calls.push({term,literal:context.literalSearch,vehicle:context.state.vehicle});};
 runInNewContext(code+'\nthis.search=search;',context);return context;
}
test("the actual website search sends the corrected term while retaining visible original input and vehicle",async()=>{
 const c=setup("oelfillter");await c.search();assert.equal(c.calls.length,1);assert.equal(c.calls[0].term,"Ölfilter");assert.equal(c.$("partSearch").value,"oelfillter");assert.equal(c.calls[0].vehicle.model,"Golf");assert.equal(c.interpreted.original,"oelfillter");
});
test("the actual website asks before searching ambiguous input and clears previous offers",async()=>{
 const c=setup("kupplung steuergerät");await c.search();assert.equal(c.calls.length,0);assert.equal(c.interpreted.status,"ambiguous");assert.equal(c.clearCount,1);assert.equal(c.$("resultsGrid").clearCount,1);assert.equal(c.$("searchGuide").hidden,true);
});
test("the actual original-wording action bypasses correction without changing the selected car",async()=>{
 const c=setup("kupplung steuergerät");await c.search({literal:true});assert.equal(c.calls.length,1);assert.equal(c.calls[0].term,"kupplung steuergerät");assert.equal(c.calls[0].literal,true);
});
