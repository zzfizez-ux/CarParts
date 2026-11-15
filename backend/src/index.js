// Cloudflare Worker + D1. Production catalog API; no sample products or invented fitment.
const cors=(origin,env)=>({"Access-Control-Allow-Origin":env.ALLOWED_ORIGIN||origin||"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization","Vary":"Origin"});
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
const bad=(message,status=400,headers={})=>json({error:message},status,headers);
const validString=(v,n=200)=>typeof v==="string"&&v.trim().length>0&&v.length<=n;
const clean=(v)=>typeof v==="string"?v.trim():"";
const allowedModes=new Set(["value","premium","oem"]);
const qmarks=n=>Array(n).fill("?").join(",");
function sqlRows(stmt){return stmt.all().then(r=>r.results||[])}
async function search(db,request){
 const {vehicle={},query="",mode="value"}=request||{};
 if(!validString(query,120))return {error:"Search term is required.",status:400};
 if(!allowedModes.has(mode))return {error:"Invalid mode.",status:400};
 if(!validString(vehicle.make,100)||!validString(vehicle.model,100)||!/^\d{4}$/.test(String(vehicle.year||"")))return {error:"Brand, model and year are required.",status:400};
 const args=[vehicle.make.trim(),vehicle.model.trim(),Number(vehicle.year),"%"+query.trim().toLowerCase().replace(/[%_]/g,"") +"%"];
 const sql=`SELECT DISTINCT a.id,a.name,a.brand,a.article_number,a.category,a.type,a.is_oem,
 (SELECT GROUP_CONCAT(number,'|') FROM oe_numbers WHERE article_id=a.id) AS oe,
 (SELECT GROUP_CONCAT(reference_number,'|') FROM cross_references WHERE article_id=a.id) AS crossrefs,
 f.engine_code,f.variant,f.qualification,f.notes
 FROM articles a
 JOIN fitments f ON f.article_id=a.id
 JOIN vehicles v ON v.id=f.vehicle_id
 WHERE lower(v.make)=lower(?) AND lower(v.model)=lower(?) AND v.year=?
 AND (lower(a.name) LIKE ? OR EXISTS (SELECT 1 FROM oe_numbers n WHERE n.article_id=a.id AND lower(n.number) LIKE ?)
 OR EXISTS (SELECT 1 FROM cross_references c WHERE c.article_id=a.id AND lower(c.reference_number) LIKE ?))
 LIMIT 100`;
 const matches=await sqlRows(db.prepare(sql).bind(...args,args[3],args[3]));
 const results=[];
 for(const row of matches){
  const engineOk=!row.engine_code||(clean(vehicle.engine)&&row.engine_code.toLowerCase()===vehicle.engine.trim().toLowerCase());
  const variantOk=!row.variant||(clean(vehicle.variant)&&row.variant.toLowerCase()===vehicle.variant.trim().toLowerCase());
  const confirmed=Boolean(engineOk&&variantOk&&row.qualification==="verified");
  const offers=await sqlRows(db.prepare("SELECT o.price_cents,o.currency,o.in_stock,o.updated_at,s.name AS seller,s.url FROM offers o JOIN sellers s ON s.id=o.seller_id WHERE o.article_id=? ORDER BY o.price_cents ASC LIMIT 20").bind(row.id));
  const available=offers.filter(x=>x.in_stock===1&&Number.isInteger(x.price_cents)&&x.price_cents>=0);
  const offer=mode==="premium"?available[available.length-1]:available[0];
  if(mode==="oem"&&!row.is_oem)continue;
  results.push({name:row.name,brand:row.brand,articleNumber:row.article_number,type:row.type||row.category,oeNumbers:row.oe?row.oe.split("|"):[],crossReferences:row.crossrefs?row.crossrefs.split("|"):[],fitment:{status:confirmed?"confirmed":"unverified",reason:confirmed?"Verified catalog linkage"+(row.notes?": "+row.notes:""):"Engine/variant or verified linkage missing. Confirm before ordering."},price:offer?offer.price_cents/100:null,currency:offer?.currency||"EUR",priceIncludesVat:false,seller:offer?.seller||null,availability:offer?"In stock":"No current offer",url:offer?.url||null,updatedAt:offer?.updated_at||null});
 }
 return {results};
}
async function importBatch(db,body){
 const {vehicles=[],articles=[],oeNumbers=[],crossReferences=[],fitments=[],sellers=[],offers=[]}=body||{};
 const sets=[vehicles,articles,oeNumbers,crossReferences,fitments,sellers,offers];
 if(sets.some(a=>!Array.isArray(a)||a.length>500))return {error:"Each array must contain at most 500 rows.",status:400};
 const queries=[];
 for(const v of vehicles){if(!validString(v.id)||!validString(v.make)||!validString(v.model)||!Number.isInteger(v.year))return {error:"Invalid vehicle.",status:400};queries.push(db.prepare("INSERT INTO vehicles(id,make,model,year,engine_code,variant) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET make=excluded.make,model=excluded.model,year=excluded.year,engine_code=excluded.engine_code,variant=excluded.variant").bind(v.id,v.make,v.model,v.year,v.engineCode||null,v.variant||null))}
 for(const a of articles){if(!validString(a.id)||!validString(a.name)||!validString(a.brand)||!validString(a.articleNumber))return {error:"Invalid article.",status:400};queries.push(db.prepare("INSERT INTO articles(id,name,brand,article_number,category,type,is_oem) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,article_number=excluded.article_number,category=excluded.category,type=excluded.type,is_oem=excluded.is_oem").bind(a.id,a.name,a.brand,a.articleNumber,a.category||null,a.type||null,a.isOem?1:0))}
 for(const n of oeNumbers){queries.push(db.prepare("INSERT OR IGNORE INTO oe_numbers(article_id,number,manufacturer) VALUES(?,?,?)").bind(n.articleId,n.number,n.manufacturer||""))}
 for(const n of crossReferences){queries.push(db.prepare("INSERT OR IGNORE INTO cross_references(article_id,reference_number,brand) VALUES(?,?,?)").bind(n.articleId,n.number,n.brand||""))}
 for(const f of fitments){if(!["verified","unverified"].includes(f.qualification))return {error:"Fitment qualification must be verified or unverified.",status:400};queries.push(db.prepare("INSERT INTO fitments(article_id,vehicle_id,engine_code,variant,qualification,notes) VALUES(?,?,?,?,?,?) ON CONFLICT(article_id,vehicle_id,engine_code,variant) DO UPDATE SET qualification=excluded.qualification,notes=excluded.notes").bind(f.articleId,f.vehicleId,f.engineCode||"",f.variant||"",f.qualification,f.notes||""))}
 for(const s of sellers){queries.push(db.prepare("INSERT INTO sellers(id,name,url) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url").bind(s.id,s.name,s.url||null))}
 for(const o of offers){if(!Number.isInteger(o.priceCents)||o.priceCents<0)return {error:"Offer price must be nonnegative integer cents.",status:400};queries.push(db.prepare("INSERT INTO offers(article_id,seller_id,price_cents,currency,in_stock,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(article_id,seller_id) DO UPDATE SET price_cents=excluded.price_cents,currency=excluded.currency,in_stock=excluded.in_stock,updated_at=excluded.updated_at").bind(o.articleId,o.sellerId,o.priceCents,o.currency||"EUR",o.inStock?1:0,new Date().toISOString()))}
 if(queries.length)await db.batch(queries);
 return {ok:true,imported:queries.length};
}
export default {async fetch(request,env){
 const origin=request.headers.get("Origin")||"";
 const headers=cors(origin,env);
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(!env.DB)return bad("D1 database binding DB is missing.",503,headers);
 const url=new URL(request.url);
 if(url.pathname==="/health"&&request.method==="GET")return json({ok:true,service:"CarParts catalog",catalog:"database"},200,headers);
 if(url.pathname==="/catalog/search"&&request.method==="POST"){
  let body;try{body=await request.json()}catch{return bad("Invalid JSON",400,headers)}
  try{const result=await search(env.DB,body);if(result.error)return bad(result.error,result.status,headers);return json(result,200,headers)}catch(e){return bad("Catalog search failed.",500,headers)}
 }
 if(url.pathname==="/admin/import"&&request.method==="POST"){
  if(!env.IMPORT_TOKEN||request.headers.get("Authorization")!=="Bearer "+env.IMPORT_TOKEN)return bad("Unauthorized",401,headers);
  let body;try{body=await request.json()}catch{return bad("Invalid JSON",400,headers)}
  try{const result=await importBatch(env.DB,body);return result.error?bad(result.error,result.status,headers):json(result,200,headers)}catch(e){return bad("Import failed. Check database constraints and source data.",400,headers)}
 }
 return bad("Not found",404,headers);
}};