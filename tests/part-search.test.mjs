import {test} from "node:test";
import assert from "node:assert/strict";
import {partNames,understandPartQuery,suggestPartQueries} from "../supabase/functions/live-web-search/part-search.mjs";
import {matchesPartText} from "../supabase/functions/live-web-search/vehicle-fitment.mjs";

test("common misspellings, transpositions and split German compounds resolve to searchable names",()=>{
 const cases={"oelfillter":"Ölfilter","ölfitler":"Ölfilter","bremsbelege vorne":"Bremsbeläge vorne","brems beläge hinten links":"Bremsbeläge hinten links","Bremsklöze hinten":"Bremsbeläge hinten","innenraumfiler":"Innenraumfilter","Wisch Wasser Pumpe":"Scheibenwaschpumpe","getriebe steuergerät":"Getriebesteuergerät","waermepumpe":"Wärmepumpe","Luft Massen Messer":"Luftmassenmesser"};
 for(const [input,expected] of Object.entries(cases)){const found=understandPartQuery(input);assert.equal(found.query,expected,input);assert.equal(found.status,"corrected",input);}
});
test("the user's clutch example, including typos, asks a meaningful question instead of choosing a clutch kit",()=>{
 for(const query of ["Kupplung Steuergerät","kupllung steuergeret","Kupllungssteuergerät","clutch control unit"]){
  const result=understandPartQuery(query);assert.equal(result.status,"ambiguous",query);assert.equal(result.category,"");assert.deepEqual(result.suggestions.map(item=>item.label),["Getriebesteuergerät","Getriebemechatronik","Kupplungsaktuator"]);
  assert.ok(result.suggestions.every(item=>item.description.length>20));
 }
 assert.equal(understandPartQuery("Kupplungsaktuator").status,"exact");
 assert.equal(understandPartQuery("Getriebe Steuergerät").query,"Getriebesteuergerät");
});
test("plain language, German/English aliases and new EV parts share the same catalogue vocabulary",()=>{
 const cases={"ich brauche einen pollenfilter":"Innenraumfilter","Spritfilter":"Kraftstofffilter","Motor Steuergerät":"Motorsteuergerät","clutch actuator":"Kupplungsaktuator","Onboard Charger":"Onboard-Ladegerät","Hochvolt Batterie":"Hochvoltbatterie","brake shoe kit hinten":"Bremsbackensatz hinten","Ladekabel Typ 2":"Ladekabel Typ 2"};
 for(const [input,expected] of Object.entries(cases))assert.equal(understandPartQuery(input).query,expected,input);
 assert.equal(understandPartQuery("Ladekabel Typ 2").category,"Ladekabel");
 assert.equal(matchesPartText("Clutch actuator Golf VII","Kupplungsaktuator","Kupplungsaktuator"),true);
 assert.equal(matchesPartText("Gearbox transmission control unit Golf VII","Getriebesteuergerät","Getriebesteuergerät"),true);
 assert.equal(matchesPartText("Steuergerät, Automatikgetriebe Golf 7 2.0 TDI 150 PS","Getriebesteuergerät","Getriebesteuergerät"),true);
 assert.equal(matchesPartText("Motorsteuergerät Golf VII","Getriebesteuergerät","Getriebesteuergerät"),false);
});
test("positions, dimensions, unknown requirements and complete product identifiers survive correction",()=>{
 assert.equal(understandPartQuery("bremsbelege hinten rechts").query,"Bremsbeläge hinten rechts");
 assert.ok(understandPartQuery("kupplung steuergerät links").suggestions.every(item=>item.query.endsWith(" links")));
 assert.equal(understandPartQuery("Bremsscheiben 312 mm").query,"Bremsscheiben 312 mm");
 assert.equal(understandPartQuery("Bremsbeläge Keramik").category,"");
 assert.equal(understandPartQuery("Ölfilter mit Dichtungen").status,"exact");
 for(const value of ["5Q0 615 301","09.9145.11","HU 7020 z","03N115562","P0420","B1234","U0100"]){const result=understandPartQuery(value);assert.equal(result.query,value);assert.equal(result.status,"identifier");}
 assert.equal(understandPartQuery("Raketenteil xyz").query,"Raketenteil xyz");assert.equal(understandPartQuery("Raketenteil xyz").status,"unknown");
});
test("canonical names stay stable and broad or multiple component names get bounded choices",()=>{
 for(const name of partNames)assert.equal(understandPartQuery(name).query,name,name);
 assert.equal(understandPartQuery("Bremsen").suggestions.length,3);
 assert.equal(understandPartQuery("Filter").suggestions.length,4);
 assert.equal(understandPartQuery("Bremsscheiben und Bremsbeläge").status,"ambiguous");
 assert.equal(understandPartQuery("Kupplung Steuergerät",{literal:true}).status,"literal");
 assert.equal(understandPartQuery("oelfillter",{literal:true}).query,"oelfillter");
});
test("typing suggestions remain local, bounded and preserve qualifiers",()=>{
 assert.equal(suggestPartQueries("br").length,0);assert.ok(suggestPartQueries("brems").length<=5);
 assert.ok(suggestPartQueries("getriebest").some(item=>item.query==="Getriebesteuergerät"));
 assert.equal(suggestPartQueries("bremsbelege vorne")[0].query,"Bremsbeläge vorne");
 assert.deepEqual(suggestPartQueries("HU7020Z"),[]);
});

test("hyphens and numeric requirements are preserved without treating descriptive words as article numbers",()=>{
 assert.equal(understandPartQuery("bremsbelege-vorne").query,"Bremsbeläge vorne");
 assert.equal(understandPartQuery("bremsbelege vorne 312mm").query,"Bremsbeläge vorne 312mm");
 const value="bremsbelege "+"A".repeat(55)+" 12345678";assert.ok(value.length<=80);assert.equal(understandPartQuery(value).query.endsWith("12345678"),true);
});
