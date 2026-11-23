import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogueEngines, catalogueParts} from "../supabase/functions/live-web-search/catalogue.mjs";
import {matchesPart, seriesEvidence, seriesKey} from "../supabase/functions/live-web-search/vehicle-fitment.mjs";

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

test("an explicit brake equipment code narrows the correct axle",()=>{
  const row={part_name:"Bremsscheibe vorne",category:"Bremsscheiben",fitment:{notes:"PR-Codes: 1ZF, 1ZE. 276 mm."}};
  assert.equal(matchesPart(row,"Bremsscheibe vorne PR 1ZF","Bremsscheiben"),true);
  assert.equal(matchesPart(row,"Bremsscheibe hinten PR 1ZF","Bremsscheiben"),false);
  assert.equal(matchesPart(row,"Bremsscheibe vorne PR 1LV","Bremsscheiben"),false);
});

test("browsing returns the selected engine's full verified list",async()=>{
  const profile={make:"Volkswagen",model:"Golf",series:"Golf VII",year:2015,engine:"2.0 TDI CRBC"};
  const engine={id:1,designation:profile.engine,engine_code:"CRBC"};
  const rows=[
    {id:1,engine_id:1,parts:{id:4,part_name:"Querlenker vorne links",category:"Querlenker",manufacturer_part_number:"AB1234"}},
    {id:2,engine_id:1,parts:{id:5,part_name:"Ölfilter",category:"Ölfilter",manufacturer_part_number:"CD5678"}}
  ];
  const read=async()=>rows;
  assert.deepEqual((await catalogueParts(read,[engine],profile,"","")).map(row=>row.id),[4,5]);
  assert.deepEqual((await catalogueParts(read,[engine],profile,"Lenker vorne links","Querlenker")).map(row=>row.id),[4]);
  assert.deepEqual(await catalogueParts(read,[engine],{...profile,engine:"CRBC"},"",""),[]);
});

test("new manufacturer applications keep body styles and generations separate",()=>{
  assert.equal(seriesKey("BMW","X3","X3 (2014)"),"f25");
  assert.equal(seriesKey("BMW","X5","X5 (2010)"),"e70");
  assert.equal(seriesKey("BMW","1er","1 Series (2011)"),"f20");
  assert.equal(seriesKey("BMW","1er","1 Series 3 doors (2012)"),"f21");
  assert.equal(seriesKey("Audi","A6","A6 (2014)"),"c7 limousine");
  assert.notEqual(seriesKey("Audi","A6","A6 Avant (2014)"),"c7 limousine");
  assert.equal(seriesKey("Audi","Q5","Q5 (2012)"),"8r");
  assert.notEqual(seriesKey("Audi","Q5","Q5 (2020)"),"8r");
  assert.equal(seriesKey("Volkswagen","Polo","Polo 5 Doors (2009)"),"polo v");
  assert.equal(seriesKey("Volkswagen","Polo","Polo 3 Doors (2014)"),"polo v");
  assert.equal(seriesKey("Volkswagen","Polo","Polo 5 Doors (2021)"),"polo vi");
  assert.notEqual(seriesKey("Volkswagen","Polo","Polo Sedan (2010)"),"polo v");
});

test("new brake and auxiliary-drive queries retain category and equipment restrictions",()=>{
  const shoes={part_name:"Bremsbacken hinten",category:"Bremsbacken",fitment:{notes:"PR-Codes: 1KC."}};
  assert.equal(matchesPart(shoes,"Bremsbacken hinten PR 1KC","Bremsbacken"),true);
  assert.equal(matchesPart(shoes,"Bremsbacken vorne PR 1KC","Bremsbacken"),false);
  assert.equal(matchesPart(shoes,"Bremsbacken hinten PR 1KK","Bremsbacken"),false);
  assert.equal(matchesPart({part_name:"Keilrippenriemensatz",category:"Keilrippenriemen"},"Keilrippenriemensatz"),true);
});
