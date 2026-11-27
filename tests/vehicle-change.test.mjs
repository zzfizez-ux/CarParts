import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const code=app.slice(app.indexOf('let lastVehicleProfile="";'),app.indexOf('function icon('));
function setup(){
 const values={make:"Volkswagen",model:"Golf",series:"Golf VII",year:"2015",engine:"CRBC",variant:""};
 const elements=new Map(Object.entries(values).map(([id,value])=>[id,{value}]));
 const $=id=>{if(!elements.has(id))elements.set(id,{replaceChildren(){},value:""});return elements.get(id);};
 const context={$,state:{vehicle:null},vinResult:{status:"idle",vin:""},hasSeries:true,selectedSeries:()=>$("series").value,
  chosenEngine:()=>$("engine").value,vehicleLabel:()=>"Golf VII",catalogRequest:0,searchDetails:{},guideIdentity:"",skipPreflight:false,
  updatePartsCoverage(){},updateRegistryEvidence(){},refreshVinComparison(){},renderCount:0};
 context.renderResults=()=>context.renderCount++;
 runInNewContext(code+'\nthis.vehicleChanged=vehicleChanged;',context);return context;
}
test("repeated unchanged vehicle events preserve the active search and its refinements",()=>{
 const c=setup();c.vehicleChanged();const request=c.catalogRequest,count=c.renderCount;
 c.searchDetails={axle:"front"};c.guideIdentity="active-query";c.skipPreflight=true;
 c.vehicleChanged();
 assert.equal(c.catalogRequest,request);assert.equal(c.renderCount,count);assert.equal(c.searchDetails.axle,"front");assert.equal(c.guideIdentity,"active-query");assert.equal(c.skipPreflight,true);
 c.$("engine").value="CLHA";c.vehicleChanged();assert.equal(c.catalogRequest,request+1);assert.equal(c.renderCount,count+1);assert.equal(Object.keys(c.searchDetails).length,0);assert.equal(c.skipPreflight,false);
});
test("VIN status and actual vehicle changes still invalidate old search results",()=>{
 const c=setup();c.vehicleChanged();const request=c.catalogRequest;
 c.vinResult.status="mismatch";c.vinResult.vin="test-memory-value";c.vehicleChanged();assert.equal(c.catalogRequest,request+1);assert.equal(c.$("saveGarageBtn").disabled,true);
 c.$("year").value="2016";c.vehicleChanged();assert.equal(c.catalogRequest,request+2);assert.equal(c.state.vehicle.year,"2016");
});
