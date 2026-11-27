import {test} from "node:test";
import assert from "node:assert/strict";
import {createEbaySearch, ebayOffers, externalSearches, lookupWeb, partsQuery} from "../supabase/functions/live-web-search/search-providers.mjs";

const vehicle = {make:"Tesla",model:"Model 3",series:"",year:2021,engine:"Elektro",variant:""};
const json = data => Response.json(data);
const listing = {title:"Tesla Model 3 Inverter Elektro",itemWebUrl:"https://www.ebay.de/itm/123456789012",
  image:{imageUrl:"https://i.ebayimg.com/images/test.jpg"},price:{value:"189.90",currency:"EUR"},condition:"Gebraucht"};

test("arbitrary ICE and EV parts reach search without a supported-category gate",()=>{
  for (const part of ["Inverter","Ladekabel","Antriebswelle","Zylinderkopf","Dieselpumpe","Türgriff hinten links"]){
    const link = new URL(externalSearches(vehicle,part)[0].url);
    assert.equal(link.origin,"https://www.ebay.de");
    assert.equal(link.searchParams.get("_nkw"),partsQuery(vehicle,part,200));
    assert.ok(partsQuery(vehicle,part,100).startsWith(part));
    assert.equal(link.searchParams.get("_sacat"),"131090");
  }
});

test("Brave uses the server secret, German search and its documented envelope",async()=>{
  const result = await lookupWeb("Model 3 Inverter","private-test",async(url,options)=>{
    const query = new URL(url);
    assert.equal(query.origin,"https://api.search.brave.com");
    assert.equal(query.searchParams.get("q"),"Model 3 Inverter");
    assert.equal(query.searchParams.get("country"),"DE");
    assert.equal(options.headers["X-Subscription-Token"],"private-test");
    return json({web:{results:[{title:"Inverter",url:"https://example.com/part",description:"Model 3"}]}});
  });
  assert.equal(result.provider,"brave");
  assert.equal(result.results[0].content,"Model 3");
  assert.ok(!JSON.stringify(result).includes("private-test"));
});

test("missing Brave credentials retain the free provider and failures are explicit",async()=>{
  const free = await lookupWeb("Dieselpumpe",undefined,async url=>{
    assert.equal(new URL(url).hostname,"api.mwmbl.org");
    return json({results:[]});
  });
  assert.equal(free.provider,"mwmbl");
  for (const [http,status] of [[403,"access"],[429,"quota"],[500,"provider_error"]]) {
    assert.equal((await lookupWeb("test","key",async()=>new Response("",{status:http}))).status,status);
  }
  assert.equal((await lookupWeb("test","key",async()=>json({unexpected:[]}))).status,"provider_error");
});

test("eBay listings remain unconfirmed, deduplicate and reject unsafe or irrelevant offers",()=>{
  const offers = ebayOffers({itemSummaries:[listing,listing,
    {...listing,title:"Tesla Model 3 Fußmatten"},
    {...listing,itemWebUrl:"https://www.ebay.de.evil.test/itm/123"},
    {...listing,price:{value:"10",currency:"USD"}},
    {...listing,image:{imageUrl:"https://evil.test/pixel"}},
    {...listing,price:{value:"NaN",currency:"EUR"}}]},vehicle,"Inverter","");
  assert.equal(offers.length,1);
  assert.equal(offers[0].price,189.9);
  assert.equal(offers[0].fitment_status,"unconfirmed");
  assert.equal(offers[0].source_url,"");
  assert.equal(offers[0].part_id,undefined);
  assert.equal(ebayOffers({itemSummaries:[{...listing,image:undefined}]},vehicle,"Inverter","")[0].image,"");
  assert.deepEqual(ebayOffers({total:0},vehicle,"Inverter",""),[]);
});

test("eBay application token is reused and all parts use the DE marketplace",async()=>{
  let tokens=0,queries=0;
  const search=createEbaySearch(async(url,options)=>{
    if(url.includes("oauth2/token")){
      tokens++;
      assert.equal(options.headers.Authorization,"Basic "+btoa("client:secret"));
      assert.equal(new URLSearchParams(options.body).get("grant_type"),"client_credentials");
      return json({access_token:"token",expires_in:7200});
    }
    queries++;
    assert.equal(options.headers["X-EBAY-C-MARKETPLACE-ID"],"EBAY_DE");
    assert.equal(new URL(url).searchParams.get("category_ids"),"131090");
    return json({itemSummaries:[listing]});
  });
  assert.equal((await search(vehicle,"Inverter","","client","secret")).offers.length,1);
  await search(vehicle,"Ladekabel","","client","secret");
  assert.equal(tokens,1);assert.equal(queries,2);
  assert.equal((await search(vehicle,"Inverter","",undefined,undefined)).status,"not_configured");
  assert.equal(queries,2);
});

test("expired eBay credentials renew once, production denial stays an access error",async()=>{
  let tokens=0,queries=0;
  const search=createEbaySearch(async url=>{
    if(url.includes("oauth2/token")){tokens++;return json({access_token:"token"+tokens,expires_in:7200});}
    queries++;
    return queries===1 ? new Response("",{status:401}) : json({total:0});
  });
  assert.equal((await search(vehicle,"Inverter","","id","secret")).status,"empty");
  assert.equal(tokens,2);assert.equal(queries,2);
  const denied=createEbaySearch(async()=>new Response("private upstream error",{status:403}));
  assert.deepEqual(await denied(vehicle,"Inverter","","id","secret"),{status:"access",offers:[]});
});

test("known conflicting chassis and opposite brake axles never become marketplace offers",()=>{
  const car={make:"Mercedes-Benz",model:"S-Klasse",series:"W221",year:2012,engine:"S 350",variant:""};
  const wrong={...listing,title:"Bremsscheiben vorne Mercedes S-Klasse W222"};
  assert.deepEqual(ebayOffers({itemSummaries:[wrong]},car,"Bremsscheiben vorne","Bremsscheiben"),[]);
  assert.deepEqual(ebayOffers({itemSummaries:[{...wrong,title:"Bremsscheiben hinten Mercedes W221"}]},car,"Bremsscheiben vorne","Bremsscheiben"),[]);
});

test("Serper uses one standard German request and normalizes organic results",async()=>{
  const {lookupSerper}=await import("../supabase/functions/live-web-search/search-providers.mjs");
  let calls=0;
  const result=await lookupSerper("Golf VII Ölfilter","private-serper",async(url,options)=>{
    calls++;assert.equal(url,"https://google.serper.dev/search");
    assert.equal(options.method,"POST");assert.equal(options.headers["X-API-KEY"],"private-serper");
    assert.deepEqual(JSON.parse(options.body),{q:"Golf VII Ölfilter",gl:"de",hl:"de",num:10});
    return Response.json({organic:[{title:"Ölfilter",link:"https://levoil.de/produkt/",snippet:"Golf VII"}]});
  });
  assert.equal(calls,1);assert.equal(result.provider,"serper");
  assert.equal(result.results[0].url,"https://levoil.de/produkt/");assert.equal(result.results[0].content,"Golf VII");
  assert.ok(!JSON.stringify(result).includes("private-serper"));
});

test("Serper reports empty credits and missing keys without additional provider attempts",async()=>{
  const {lookupSerper}=await import("../supabase/functions/live-web-search/search-providers.mjs");
  let calls=0;const request=async()=>{calls++;return new Response("upstream-private-message",{status:402});};
  assert.equal((await lookupSerper("test",undefined,request)).status,"not_configured");assert.equal(calls,0);
  assert.deepEqual(await lookupSerper("test","key",request),{status:"quota",provider:"serper",results:[]});assert.equal(calls,1);
  assert.equal((await lookupSerper("test","key",async()=>Response.json({error:"no results envelope"}))).status,"provider_error");
});


test("research sources exclude search-engine session redirects and eBay listings",async()=>{
 const {researchSourceUrl}=await import("../supabase/functions/live-web-search/search-providers.mjs");
 assert.equal(researchSourceUrl("https://www.google.com/goto?url=opaque&gsessionid=session"),null);
 assert.equal(researchSourceUrl("https://www.ebay.de/itm/123456789"),null);
 assert.equal(researchSourceUrl("https://levoil.de/produkt/filter/").hostname,"levoil.de");
});


test("discovery omits unrelated engine-label annotations without changing fitment data",()=>{
 const selected={make:"Volkswagen",model:"Golf",series:"Golf VII",year:2015,engine:"Golf VII 2.0 TDI 150 PS (CRBC) – mit Wassersensor",variant:"DSG"};
 const phrase=partsQuery(selected,"Getriebesteuergerät");
 assert.ok(phrase.startsWith("Getriebesteuergerät"));assert.ok(phrase.includes("CRBC"));assert.ok(phrase.includes("DSG"));assert.ok(!phrase.includes("Wassersensor"));assert.ok(selected.engine.includes("mit Wassersensor"));
});
