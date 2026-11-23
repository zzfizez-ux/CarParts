import {test} from "node:test";
import assert from "node:assert/strict";

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
  } finally { delete globalThis.window; }
});
