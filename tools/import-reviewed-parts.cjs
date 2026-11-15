// CarParts: ingest only independently reviewed, authorized parts evidence.
// Usage: node tools/import-reviewed-parts.cjs records.json [--apply]
// Dry run by default. Keep SUPABASE_SERVICE_ROLE_KEY in a private server environment.
const fs=require("node:fs");
const args=process.argv.slice(2),file=args.find(x=>!x.startsWith("--"));
if(!file)throw Error("Usage: node tools/import-reviewed-parts.cjs records.json [--apply]");
const records=JSON.parse(fs.readFileSync(file,"utf8"));
if(!Array.isArray(records)||!records.length||records.length>1000)throw Error("Expected 1–1000 reviewed JSON records");
const required=["make","model","designation","engine_code","manufacturer","part_name",
"manufacturer_part_number","category","source_url","fitment_notes"];
const https=x=>{try{return new URL(x).protocol==="https:"}catch{return false}};
for(const [i,r] of records.entries()){
 for(const k of required)if(typeof r[k]!=="string"||!r[k].trim())throw Error("Record "+i+": "+k+" missing");
 if(r.reviewed!==true||!["manufacturer_application","licensed_feed"].includes(r.source_type))
  throw Error("Record "+i+": explicit review and source_type required");
 if(!https(r.source_url)||r.fitment_notes.length<35)throw Error("Record "+i+": source or fitment evidence invalid");
 if(!Number.isInteger(r.year_from)||!Number.isInteger(r.year_to)||r.year_from<1886||
 r.year_to<r.year_from||r.year_to>2100)throw Error("Record "+i+": invalid production years");
 if(r.source_type==="licensed_feed"&&!r.license_basis)throw Error("Record "+i+": missing license statement");
 if(r.image_url||r.price||r.offer)throw Error("Record "+i+": images and offers need separate review");
}
console.log("Validated "+records.length+" reviewed vehicle-to-part links");
if(!args.includes("--apply"))process.exit(0);
const base=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!https(base)||new URL(base).hostname!=="umhzxsryqhwzxrmkbmwp.supabase.co"||!key)
 throw Error("Set private SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for CarParts");
async function api(table,method,params={},body){
 const u=new URL(base+"/rest/v1/"+table);
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
 const response=await fetch(u,{method,headers:{apikey:key,Authorization:"Bearer "+key,
 "Content-Type":"application/json","Prefer":"return=representation,resolution=merge-duplicates"},
 body:body?JSON.stringify(body):undefined});
 if(!response.ok)throw Error(table+": HTTP "+response.status);
 return response.json();
}
async function find(table,filter){
 const result=await api(table,"GET",{select:"id",limit:1,...filter});return result[0]||null;
}
async function main(){
 let n=0;
 for(const r of records){
  const brand=await find("car_brands",{name:"eq."+r.make});
  if(!brand)throw Error("Not a curated brand: "+r.make);
  const model=await find("car_models",{brand_id:"eq."+brand.id,name:"eq."+r.model});
  if(!model)throw Error("Not a curated model: "+r.make+" "+r.model);
  let engine=await find("car_engines",{model_id:"eq."+model.id,designation:"eq."+r.designation});
  if(!engine)engine=(await api("car_engines","POST",{},[{model_id:model.id,
   designation:r.designation,engine_code:r.engine_code,year_from:r.year_from,
   year_to:r.year_to,fuel_type:r.fuel_type||null}]))[0];
  const part=(await api("parts","POST",{on_conflict:"manufacturer,manufacturer_part_number"},[{
   manufacturer:r.manufacturer,part_name:r.part_name,
   manufacturer_part_number:r.manufacturer_part_number,category:r.category,
   source_url:r.source_url,verification_status:"verified"}]))[0];
  await api("part_fitments","POST",{on_conflict:"part_id,engine_id"},[{
   part_id:part.id,engine_id:engine.id,source_url:r.source_url,notes:r.fitment_notes,
   status:"verified",verified_at:new Date().toISOString()}]);
  console.log("Imported "+(++n)+"/"+records.length+": "+r.manufacturer_part_number);
 }
}
main().catch(err=>{console.error(err.message);process.exitCode=1});