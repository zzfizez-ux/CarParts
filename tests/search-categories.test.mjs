import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("frontend catalogue imports use the same vehicle-mapping version at every level",async()=>{
  const frontend=await readFile(new URL("../supabase-catalog.js",import.meta.url),"utf8");
  const catalogue=await readFile(new URL("../supabase/functions/live-web-search/catalogue.mjs",import.meta.url),"utf8");
  const direct=frontend.match(/vehicle-fitment\.mjs\?v=(\d+)/)?.[1];
  const nested=catalogue.match(/vehicle-fitment\.mjs\?v=(\d+)/)?.[1];
  assert.ok(direct);
  assert.equal(nested,direct,"old cached chassis mappings must not hide newly imported motors");
});

test("the website selects complete new brake categories before shorter synonyms",async()=>{
  globalThis.window={CARPARTS_SUPABASE_CONFIG:{url:"https://supabase.example",publishableKey:"public-test-key"}};
  try {
    await import("../supabase-catalog.js");
    const category=window.CarPartsDB.researchCategory;
    assert.equal(category("brake shoe kit hinten"),"Bremsbackensatz");
    assert.equal(category("brake shoes hinten"),"Bremsbacken");
    assert.equal(category("Bremstrommel hinten"),"Bremstrommeln");
    assert.equal(category("Radbremszylinder hinten"),"Radbremszylinder");
    assert.equal(category("Keilrippenriemensatz"),"Keilrippenriemen");
    assert.equal(category("Inverter"),"Inverter");
    assert.equal(category("Onboard Charger"),"Onboard-Ladegerät");
    assert.equal(category("Hochvolt Batterie"),"Hochvoltbatterie");
    assert.equal(category("Antriebswellen"),"Antriebswelle");
    assert.equal(category("Ladekabel Typ 2"),"Ladekabel");
    assert.equal(category("Getriebeöl"),"Getriebeöl");
  } finally { delete globalThis.window; }
});
