import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogueEngines, catalogueParts} from "../supabase/functions/live-web-search/catalogue.mjs";
import {matchesPart, seriesEvidence} from "../supabase/functions/live-web-search/vehicle-fitment.mjs";

test("W222 brake discs conflict with W221 of the same model year",()=>{
  const car={make:"Mercedes-Benz",model:"S-Klasse",series:"W221",year:2013,engine:"S 63 AMG"};
  assert.equal(seriesEvidence(car,"Bremsscheibe S-Klasse W222 + A217 + C217"),"conflict");
  assert.equal(seriesEvidence({...car,series:"W222"},"Bremsscheibe S-Klasse W 222 + A217 + C217"),"match");
});

test("generation matching uses remote labels as well as vehicle codes",()=>{
  assert.equal(seriesEvidence({make:"Tesla",model:"Model 3",series:"Model 3 (2023)"},
    "Rücklicht für Model 3 (2017)",["Model 3 (2017)","Model 3 (2023)"]),"conflict");
  assert.equal(seriesEvidence({make:"Mercedes-Benz",model:"E-Klasse",series:"W212"},"E-Klasse W213"),"conflict");
});

test("engines from another generation in the same year are excluded",async()=>{
  const input={make:"BMW",model:"3er",year:2012,series:"E90"};
  const engines=[{id:1,series_keys:["e90"]},{id:2,series_keys:["f30","f31"]},{id:3,series_keys:[]}];
  const rows=await catalogueEngines(async()=>engines,input);
  assert.deepEqual(rows,[engines[0]]);
});

test("manufacturer and OE references accept alternative separators",()=>{
  const row={manufacturer:"MANN-FILTER",manufacturer_part_number:"PU 8014",part_name:"Kraftstofffilter",category:"Kraftstofffilter"};
  for(const query of ["PU 8014","PU8014","PU-8014"])assert.equal(matchesPart(row,query),true);
  assert.equal(matchesPart({...row,oe:["03N 115 562"]},"03N115562"),true);
  assert.equal(matchesPart(row,"PU8028"),false);
  assert.equal(matchesPart({part_name:"Bremsscheibe Vorderachse",category:"Bremsscheiben"},"Bremsscheiben hinten","Bremsscheiben"),false);
});

test("a generic engine choice gives a source candidate only",async()=>{
  const profile={make:"Volkswagen",model:"Golf",series:"Golf VII",year:2015,engine:"2.0 TDI"};
  const apps=[{id:1,designation:"Golf VII 2.0 TDI 150 PS (CRBC)",engine_code:"CRBC"}];
  const rows=[{engine_id:1,notes:"CRBC",parts:{id:1,part_name:"Ölfilter",manufacturer:"MANN-FILTER",manufacturer_part_number:"HU 7020 z",oe_numbers:[{oe_number:"03N 115 562"}]}}];
  const read=async()=>rows;
  assert.deepEqual(await catalogueParts(read,apps,profile,"Ölfilter","Ölfilter"),[]);
  const [part]=await catalogueParts(read,apps,profile,"03N115562","",true);
  assert.equal(part.match,"conditional");
  assert.equal(part.manufacturer_part_number,"HU 7020 z");
});

test("catalogue lookup reaches later pages and respects the imported application bounds",async()=>{
  const vehicle={make:"BMW",model:"3er",series:"F30",year:2014,engine:"320d N47D20C"};
  const engines=[{id:1,designation:vehicle.engine,engine_code:"N47D20C"}];
  const part={id:2,part_name:"Ölfilter",category:"Ölfilter",manufacturer_part_number:"HU 6004 x"};
  const page=Array.from({length:100},(_,i)=>({
    id:i+1,engine_id:1,parts:{...part,manufacturer_part_number:"HU 6019 z"}
  }));
  const calls=[];
  const read=async(table,query)=>{
    calls.push({...query});
    if(!query.id)return page;
    return [
      {id:101,engine_id:1,parts:part,series_keys:["f31"],year_from:2013,year_to:2015},
      {id:102,engine_id:1,parts:part,series_keys:["f30"],year_from:2015,year_to:2017},
      {id:103,engine_id:1,parts:part,series_keys:["f30"],year_from:2013,year_to:2015}
    ];
  };
  const found=await catalogueParts(read,engines,vehicle,"HU6004X","");
  assert.deepEqual(found.map(row=>row.fitment.id),[103]);
  assert.equal(calls[1].id,"gt.100");
});
