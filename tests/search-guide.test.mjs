import {test} from "node:test";
import assert from "node:assert/strict";
import {assessApplication,effectiveVehicle,filterApplications,filterProducts,matchesRequestedReference,requestConflicts,searchPlan,searchTerm,validateSearchDetails} from "../supabase/functions/live-web-search/search-guide.mjs";
import {matchesPartText} from "../supabase/functions/live-web-search/vehicle-fitment.mjs";
const vehicle={make:"Volkswagen",model:"Golf",series:"Golf VII",year:2015,engine:"Golf VII 2.0 TDI 150 PS (CRBC)"};
const row={id:1,match:"exact",engine:vehicle.engine,part_name:"Bremsscheibe vorne",manufacturer_part_number:"09.9145.11",oe:["5Q0 615 301"],fitment:{source_url:"https://www.bremboparts.com/application",notes:"PR-Codes: 1ZE, 1ZP. System und Ausführung prüfen."}};

test("the guide asks only for relevant, missing vehicle and position data",()=>{
 const p=searchPlan({...vehicle,engine:""},"Bremsscheiben","Bremsscheiben",{},[{designation:vehicle.engine}],[],{preflight:true});
 assert.deepEqual(p.questions.map(q=>q.key),["engine","axle"]);
 assert.equal(p.questions[0].options[0].value,vehicle.engine);
 assert.deepEqual(searchPlan(vehicle,"Ölfilter","Ölfilter",{},[],[],{preflight:true}).questions,[]);
 assert.ok(!searchPlan({...vehicle,make:"Tesla",engine:"Elektro Long Range"},"Ladekabel","Ladekabel",{},[],[],{preflight:true}).questions.some(q=>q.key==="engine"));
});

test("a user reference cannot override conflicting axle, side or PR evidence",()=>{
 const details={oe_number:"5Q0615301",equipment_code:"1ZE"};
 assert.equal(assessApplication(row,vehicle,"Bremsscheiben vorne",details).status,"reference_match");
 for(const part of [{...row,part_name:"Bremsscheibe hinten"},{...row,fitment:{...row.fitment,notes:"PR-Codes: 1KU."}}])
  assert.equal(assessApplication(part,vehicle,"Bremsscheiben vorne",details).status,"conflict");
 assert.equal(assessApplication({...row,part_name:"Außenspiegel rechts"},vehicle,"Außenspiegel links",details).status,"conflict");
 assert.deepEqual(filterApplications([row],vehicle,"Bremsscheiben",{oe_number:"WRONG123"}),[]);
});

test("conditional engines, unknown positions and missing sources never become confirmed matches",()=>{
 const details={oe_number:"5Q0615301",equipment_code:"1ZE"};
 for(const part of [{...row,match:"conditional"},{...row,part_name:"Bremsscheibe"},{...row,fitment:{notes:"PR-Codes: 1ZE."}}])
  assert.notEqual(assessApplication(part,vehicle,"Bremsscheiben vorne",details).status,"reference_match");
 assert.equal(searchPlan(vehicle,"Bremsscheiben vorne","Bremsscheiben",{oe_number:"5Q0615301"},[],[row]).questions[0].key,"equipment_code");
});

test("all supplied fields still require a manufacturer source; no endless questionnaire",()=>{
 const details={engine:vehicle.engine,oe_number:"123456",axle:"front",side:"left",equipment_code:"1ZE"};
 const p=searchPlan(vehicle,"Bremsscheiben","Bremsscheiben",details,[],[]);
 assert.equal(p.status,"needs_source");assert.deepEqual(p.questions,[]);assert.deepEqual(p.matched_parts,[]);
});

test("answers change the actual query, not just a badge",()=>{
 const details=validateSearchDetails({engine:" CRBC ",oe_number:"5Q0 615 301",axle:"front",side:"left",equipment_code:"1ze"});
 assert.equal(details.equipment_code,"1ZE");
 assert.equal(effectiveVehicle(vehicle,details).engine,"CRBC");
 assert.equal(searchTerm("Bremsscheiben",details),"Bremsscheiben vorne links");
 assert.equal(searchTerm("Bremsscheiben vorne",{axle:"front"}),"Bremsscheiben vorne");
 assert.ok(matchesPartText("Antriebswelle für BMW F30 vorne","Antriebswelle vorne","Antriebswelle"));
 assert.ok(!matchesPartText("Antriebswelle hinten BMW F30","Antriebswelle vorne","Antriebswelle"));
});

test("untrusted details reject unknown keys, VINs, invalid codes, excessive input and enums",()=>{
 for(const details of [null,[],{vin:"test"},{engine:"x".repeat(161)},{axle:"middle"},{oe_number:"abc"},{equipment_code:"1ZE,1ZP"},{engine:"WVWZZZ1KZAW000001"},{oe_number:"<script>1234"}])
  assert.throws(()=>validateSearchDetails(details));
 assert.deepEqual(validateSearchDetails(undefined),{});
});

test("contradictory positions cannot be silently overwritten by answers",()=>{
 for(const [term,details] of [["Bremsscheiben vorne",{axle:"rear"}],["Spiegel links",{side:"right"}],["Bremsscheiben vorne hinten",{}]]){
  assert.ok(requestConflicts(term,details).length);
  assert.throws(()=>searchTerm(term,details));
  assert.equal(searchPlan(vehicle,term,"",details,[],[],{preflight:true}).status,"conflict");
  assert.deepEqual(filterApplications([row],vehicle,term,details),[]);
 }
});

test("explicit references require direct evidence or a reviewed cross-reference",()=>{
 assert.ok(matchesRequestedReference("Brembo 09.9145.11","5Q0615301",[row]));
 assert.ok(!matchesRequestedReference("Ölfilter Golf VII günstig","FALSCH1234",[]));
 assert.ok(!matchesRequestedReference("Brembo 09.9145.11","FALSCH1234",[row]));
 const product={name:"Brembo Bremsscheibe vorne",sku:"09.9145.11",part_id:1,evidence:"manufacturer"};
 assert.equal(filterProducts([product],[row],"Bremsscheiben vorne",{oe_number:"5Q0615301"}).length,1);
 assert.deepEqual(filterProducts([product],[],"Bremsscheiben vorne",{oe_number:"5Q0615301"}),[]);
 assert.deepEqual(filterProducts([{...product,name:"Brembo Bremsscheibe hinten"}],[row],"Bremsscheiben vorne",{oe_number:"5Q0615301"}),[]);
});
