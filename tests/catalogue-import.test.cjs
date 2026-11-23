const {test} = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync, readdirSync} = require("node:fs");
const {resolve} = require("node:path");
const {validate} = require("../tools/import-reviewed-parts.cjs");

const directory = resolve(__dirname, "../catalogue");
const batches = readdirSync(directory).filter(name => name.endsWith(".json"))
  .map(name => ({name, rows:JSON.parse(readFileSync(resolve(directory,name),"utf8"))}));

test("every reviewed catalogue batch passes the same validation used for server imports",()=>{
  for (const {name,rows} of batches) assert.doesNotThrow(()=>validate(rows), name);
});

test("the importer rejects the swapped Brembo headings that caused incorrect search categories",()=>{
  const rows=batches.flatMap(batch=>batch.rows);
  const master=rows.find(row=>row.manufacturer==="Brembo" && row.manufacturer_part_number==="M 85 095");
  const clutch=rows.find(row=>row.manufacturer==="Brembo" && row.manufacturer_part_number==="C 85 033");
  assert.equal(master.category,"Hauptbremszylinder");
  assert.equal(clutch.category,"Kupplungsgeberzylinder");
  assert.throws(()=>validate([{...master,category:"Kupplungsgeberzylinder"}]),/Herstellerproduktblatt/);
  assert.throws(()=>validate([{...clutch,category:"Hauptbremszylinder"}]),/Herstellerproduktblatt/);
});

test("shared manufacturer articles have one category in every researched application",()=>{
  const categories=new Map();
  for (const {rows} of batches) for (const row of rows) {
    const key=row.manufacturer.toLowerCase()+"/"+row.manufacturer_part_number.toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(categories.has(key)) assert.equal(row.category,categories.get(key),key);
    categories.set(key,row.category);
  }
});
