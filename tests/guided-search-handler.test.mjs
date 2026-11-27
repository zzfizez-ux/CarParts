import {test} from "node:test";
import assert from "node:assert/strict";
import {registerHooks} from "node:module";
registerHooks({resolve(specifier,context,next){return next(specifier==="npm:linkedom@0.18.12"?"linkedom":specifier,context);}});
let handler;
const env={SUPABASE_PUBLISHABLE_KEYS:'{"default":"public-test"}',SUPABASE_SECRET_KEYS:'{"default":"private-test"}',SUPABASE_URL:"https://test.supabase.co"};
globalThis.Deno={env:{get:key=>env[key]},serve:fn=>{handler=fn;}};
await import("../supabase/functions/live-web-search/index.ts");
const vehicle={make:"Volkswagen",model:"Golf",series:"Golf VII",year:2015,engine:"Golf VII 2.0 TDI 150 PS (CRBC)",variant:"",part:"Ölfilter",category:"Ölfilter"};
const engine={id:7,designation:vehicle.engine,engine_code:"CRBC",series_keys:["golf vii"]};
const application={id:11,engine_id:7,series_keys:["golf vii"],source_url:"https://www.mann-filter.com/application",notes:"Motor und Baujahr laut Hersteller.",parts:{id:5,manufacturer:"MANN-FILTER",manufacturer_part_number:"HU 7020 z",part_name:"Ölfilter",category:"Ölfilter",oe_numbers:[{oe_number:"03N 115 562"}]}};
const product={"@type":"Product",name:"MANN-FILTER Ölfilter HU 7020 z Golf VII",brand:{name:"MANN-FILTER"},mpn:"HU 7020 z",description:"<b>Ölfiltereinsatz</b> für die dokumentierte Anwendung.",image:"https://levoil.de/hu7020z.jpg",offers:{price:"12.90",priceCurrency:"EUR"}};
const html=p=>new Response('<html><h1>'+p.name+'</h1><script type="application/ld+json">'+JSON.stringify(p)+'</script></html>',{headers:{"Content-Type":"text/html"}});
function request(body,key="public-test"){return new Request("https://test.supabase.co/functions/v1/live-web-search",{method:"POST",headers:{apikey:key,Origin:"https://zzfizez-ux.github.io","Content-Type":"application/json"},body:JSON.stringify(body)});}
function stub({electric=false,directUnavailable=false,equipmentCase=false,partialDirect=false}={}){
 const calls=[];
 globalThis.fetch=async(raw,options={})=>{
  const u=new URL(raw);calls.push(u.href);
  assert.ok(!/ebay|rapidapi|mwmbl/.test(u.hostname));
  if(u.hostname==="test.supabase.co"){
   const table=u.pathname.split("/rest/v1/")[1];
   if(table?.startsWith("rpc/reserve"))return Response.json("reserved");
   if(table==="car_engines")return Response.json(electric?[]:[engine]);
   if(table==="part_fitments")return Response.json(electric?[]:[equipmentCase?{...application,notes:"PR-Codes: 1ZE."}:application]);
   return Response.json([]);
  }
  if(u.hostname==="google.serper.dev"){
   assert.equal(options.headers["X-API-KEY"],"serper-private-test");
   if(directUnavailable||equipmentCase||partialDirect)return Response.json({organic:[{link:"https://levoil.de/sourced-filter/",title:"MANN-FILTER HU 7020 z Ölfilter",snippet:"Ölfilter HU 7020 z online kaufen"}]});
   return Response.json({organic:[{link:"https://levoil.de/tesla-inverter/",title:"Inverter Tesla Model 3 (2023)",snippet:"Inverter Elektro Long Range"}]});
  }
  if(u.pathname==="/tesla-inverter/")return html({...product,name:"Inverter Tesla Model 3 (2023)",mpn:"INV123",brand:"Tesla",description:"Inverter für Elektroantrieb",image:"https://levoil.de/inverter.jpg"});
  if(u.pathname==="/sourced-filter/")return html({...product,name:"MANN-FILTER HU 7020 z Ölfilter"});
  if(u.pathname.startsWith("/produkt/")&&!directUnavailable)return html(partialDirect?{...product,image:undefined}:product);
  return new Response('<html></html>',{headers:{"Content-Type":"text/html"}});
 };
 return calls;
}

test("real handler returns sourced price, photo, description and an assessed reference",async()=>{
 const calls=stub();
 const response=await handler(request({...vehicle,details:{oe_number:"03N115562"}}));
 assert.equal(response.status,200);
 const body=await response.json();
 assert.equal(body.products[0].price,12.9);assert.equal(body.products[0].currency,"EUR");
 assert.equal(body.products[0].image,"https://levoil.de/hu7020z.jpg");
 assert.equal(body.products[0].description,"Ölfiltereinsatz für die dokumentierte Anwendung.");
 assert.equal(body.products[0].fitment_status,"reference_match");
 assert.equal(body.search_plan.status,"reference_match");
 assert.equal(body.external_searches,undefined);assert.equal(body.marketplace_offers,undefined);
 assert.ok(!JSON.stringify(body).includes("private-test"));
 assert.ok(!calls.some(url=>url.includes("google.serper")),"known complete products do not spend a Serper query");
});

test("Serper finds a complete EV product, which remains unconfirmed without manufacturer linkage",async()=>{
 env.SERPER_API_KEY="serper-private-test";
 const calls=stub({electric:true});
 const response=await handler(request({...vehicle,make:"Tesla",model:"Model 3",series:"Model 3 (2023)",year:2024,engine:"Elektro Long Range",part:"Inverter",category:"Inverter"}));
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.provider,"serper");assert.equal(body.products.length,1);
 assert.equal(body.products[0].fitment_status,"unconfirmed");
 assert.equal(body.search_plan.status,"needs_source");
 assert.ok(body.search_plan.questions.every(q=>q.optional));
 assert.ok(body.search_plan.questions.some(q=>q.key==="oe_number"));
 assert.equal(calls.filter(url=>url.includes("google.serper.dev")).length,1);
 delete env.SERPER_API_KEY;
});

test("invalid answers are rejected before provider calls; a wrong reference cannot produce a match",async()=>{
 const calls=stub();
 assert.equal((await handler(request({...vehicle,details:{equipment_code:"INVALID"}}))).status,422);
 assert.equal(calls.length,0);
 const body=await (await handler(request({...vehicle,details:{oe_number:"WRONG1234"}}))).json();
 assert.equal(body.products.length,0);assert.equal(body.search_plan.status,"needs_source");
 assert.equal(body.web_status,"not_configured");
});

test("Serper cannot bypass a supplied reference by returning generic search hits",async()=>{
 env.SERPER_API_KEY="serper-private-test";stub({electric:true});
 const body=await (await handler(request({...vehicle,make:"Tesla",model:"Model 3",series:"Model 3 (2023)",year:2024,engine:"Elektro Long Range",part:"Inverter",category:"Inverter",details:{oe_number:"FALSCH1234"}}))).json();
 assert.equal(body.web_status,"live");assert.deepEqual(body.results,[]);assert.deepEqual(body.products,[]);
 assert.equal(body.search_plan.status,"needs_source");delete env.SERPER_API_KEY;
});

test("conflicting position answers return 422 before any database or provider request",async()=>{
 const calls=stub();
 const response=await handler(request({...vehicle,part:"Bremsscheiben vorne",category:"Bremsscheiben",details:{axle:"rear"}}));
 assert.equal(response.status,422);assert.equal(calls.length,0);
});

test("Serper discovers a retailer by reviewed article number even if the title lacks the vehicle",async()=>{
 env.SERPER_API_KEY="serper-private-test";stub({directUnavailable:true});
 const body=await (await handler(request({...vehicle,details:{oe_number:"03N115562"}}))).json();
 assert.equal(body.web_status,"live");assert.equal(body.provider,"serper");
 assert.equal(body.products.length,1);assert.equal(body.products[0].url,"https://levoil.de/sourced-filter/");
 assert.equal(body.products[0].fitment_status,"reference_match");
 assert.equal(body.products[0].price,12.9);assert.ok(body.products[0].image);assert.ok(body.products[0].description);
 delete env.SERPER_API_KEY;
});


test("a known PR-code conflict excludes matching article references from Serper too",async()=>{
 env.SERPER_API_KEY="serper-private-test";stub({equipmentCase:true});
 const body=await (await handler(request({...vehicle,details:{oe_number:"HU7020Z",equipment_code:"ZZZ"}}))).json();
 assert.equal(body.web_status,"live");assert.deepEqual(body.products,[]);assert.deepEqual(body.results,[]);
 assert.equal(body.search_plan.status,"needs_source");delete env.SERPER_API_KEY;
});


test("a complete vehicle finds priced catalogue products without asking for a mandatory reference",async()=>{
 stub();
 const body=await (await handler(request({...vehicle,details:{}}))).json();
 assert.ok(body.products.length>0);assert.equal(body.search_plan.status,"application_found");
 assert.ok(body.search_plan.questions.every(question=>question.optional));
 assert.ok(body.products.every(product=>product.fitment_status!=="reference_match"));
 assert.ok(body.products.every(product=>product.price>0&&product.image&&product.description));
});


test("a price-only direct product survives alongside a complete web-discovered product",async()=>{
 env.SERPER_API_KEY="serper-private-test";
 try{const calls=stub({partialDirect:true});
 const body=await (await handler(request({...vehicle,details:{}}))).json();
 assert.ok(body.products.some(p=>p.metadata_status==="price_only"&&p.price===12.9&&p.image===""));
 assert.ok(body.products.some(p=>p.metadata_status==="complete"&&p.url==="https://levoil.de/sourced-filter/"));
 assert.equal(calls.filter(url=>url.includes("google.serper.dev")).length,1);
 assert.ok(body.products.every(p=>Array.isArray(p.fitment_conflicts)&&Array.isArray(p.fitment_unresolved)));
 }finally{delete env.SERPER_API_KEY;}
});
