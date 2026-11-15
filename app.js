const API="https://vpic.nhtsa.dot.gov/api/vehicles";
const CATALOG_DEMO=false;
const POPULAR_MAKES=["Abarth","Alfa Romeo","Audi","BMW","BYD","Chevrolet","Citroën","Cupra","Dacia","Ferrari","Fiat","Ford","Honda","Hyundai","Jaguar","Jeep","Kia","Lamborghini","Land Rover","Lexus","Maserati","Mazda","Mercedes-Benz","MG","MINI","Mitsubishi","Nissan","Opel","Peugeot","Polestar","Porsche","Renault","Seat","Škoda","Smart","Subaru","Suzuki","Tesla","Toyota","Volkswagen","Volvo"];
const state={mode:"value",lang:localStorage.getItem("cp-lang")||"en",vehicle:null,garage:JSON.parse(localStorage.getItem("cp-garage")||"[]")};
const $=id=>document.getElementById(id),toastEl=$("toast");
function show(m){toastEl.textContent=m;toastEl.classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>toastEl.classList.remove("show"),3000)}
function api(path){return fetch(API+path,{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error("API");return r.json()})}
function years(){const y=new Date().getFullYear();$("year").innerHTML='<option value="">Select year</option>'+Array.from({length:80},(_,i)=>y-i).map(x=>'<option>'+x+'</option>').join("")}
function makeOptions(names=POPULAR_MAKES){
 return '<option value="">Marke auswählen / Select brand</option>'+names.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
}
function sourceStatus(message){
 const el=$("catalogSourceStatus");
 if(el)el.textContent=message;
}
// The curated browser list appears immediately even without network access.
function loadMakes(){
 const el=$("make");
 if(!el)return;
 const previous=el.value;
 el.innerHTML=makeOptions();
 if(POPULAR_MAKES.includes(previous))el.value=previous;
 if(!window.CarPartsDB){sourceStatus("Fahrzeugkatalog: lokale Liste");return}
 window.CarPartsDB.getBrands().then(rows=>{
  const valid=new Set(rows.map(r=>r.name));
  const names=POPULAR_MAKES.filter(name=>valid.has(name));
  if(names.length!==POPULAR_MAKES.length){
   sourceStatus("Fahrzeugkatalog: lokale Liste (Datenbank unvollständig)");
   return;
  }
  const active=el.value;
  el.innerHTML=makeOptions(names);
  if(names.includes(active))el.value=active;
  sourceStatus("Fahrzeugkatalog: Supabase ("+names.length+" Marken)");
 }).catch(()=>sourceStatus("Fahrzeugkatalog: lokale Liste (offline)"));
}
let modelRequest=0;
async function loadModels(){
 const make=$("make").value,modelSelect=$("model");
 const request=++modelRequest;
 if(!make){
  modelSelect.disabled=true;
  modelSelect.innerHTML='<option value="">Zuerst Marke wählen / Select brand first</option>';
  return [];
 }
 const catalog=window.CARPARTS_POPULAR_MODELS||{};
 const key=Object.keys(catalog).find(k=>k.toLocaleLowerCase()===make.toLocaleLowerCase());
 const fallback=key?catalog[key].split(",").map(x=>x.trim()).filter(Boolean):[];
 function renderOptions(options){
  const selected=modelSelect.value;
  modelSelect.innerHTML='<option value="">Modell auswählen / Select model</option>'+options.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  if(selected&&options.includes(selected))modelSelect.value=selected;
  modelSelect.disabled=false;
 }
 renderOptions(fallback);
 if(!window.CarPartsDB)return fallback;
 try{
  const names=await window.CarPartsDB.getModels(make);
  // Keep the curated list authoritative; prevent accidental introduction of obscure models.
  if(request!==modelRequest||$("make").value!==make)return fallback;
  const remote=new Set(names);
  if(fallback.length&&fallback.every(x=>remote.has(x))){
   renderOptions(fallback);
   sourceStatus("Fahrzeugkatalog: Supabase (Modelle geladen)");
  }else{
   sourceStatus("Fahrzeugkatalog: lokale Modelle (Datenbank unvollständig)");
  }
 }catch(e){
  if(request===modelRequest)sourceStatus("Fahrzeugkatalog: lokale Modelle (offline)");
 }
 return fallback;
}
const COMMON_ENGINES=["1.0 Benzin","1.2 Benzin","1.4 Benzin","1.5 Benzin","1.6 Benzin","1.8 Benzin","2.0 Benzin","2.5 Benzin","3.0 Benzin","4.0 Benzin","1.4 Diesel","1.5 Diesel","1.6 Diesel","1.9 Diesel","2.0 Diesel","2.2 Diesel","3.0 Diesel","Mild-Hybrid","Vollhybrid","Plug-in-Hybrid","Elektro","Andere Motorisierung (selbst eingeben)"];
const ENGINE_BY_BRAND={
 "Volkswagen":["1.0 TSI","1.2 TSI","1.4 TSI","1.5 TSI","2.0 TSI","1.6 TDI","1.9 TDI","2.0 TDI","1.4 eHybrid","1.5 eHybrid","Elektro"],
 "Audi":["1.0 TFSI","1.4 TFSI","1.5 TFSI","2.0 TFSI","3.0 TFSI","1.6 TDI","2.0 TDI","3.0 TDI","e-tron Elektro","TFSI e Plug-in-Hybrid"],
 "BMW":["116i","118i","120i","125i","128ti","M135i","316i","318i","320i","330i","340i","116d","118d","120d","316d","318d","320d","325d","330d","335d","340d","Plug-in-Hybrid","Elektro"],
 "Mercedes-Benz":["160","180","200","220","250","300","350","400","450","AMG","180 d","200 d","220 d","250 d","300 d","350 d","Plug-in-Hybrid","Elektro"],
 "Škoda":["1.0 MPI","1.0 TSI","1.2 TSI","1.4 TSI","1.5 TSI","2.0 TSI","1.6 TDI","1.9 TDI","2.0 TDI","Plug-in-Hybrid","Elektro"],
 "Seat":["1.0 MPI","1.0 TSI","1.2 TSI","1.4 TSI","1.5 TSI","2.0 TSI","1.6 TDI","1.9 TDI","2.0 TDI"],
 "Cupra":["1.5 TSI","2.0 TSI","1.4 eHybrid","1.5 eHybrid","Elektro"],
 "Opel":["1.0 Turbo","1.2 Turbo","1.4 Turbo","1.6 Benzin","2.0 Turbo","1.3 CDTI","1.5 Diesel","1.6 CDTI","1.7 CDTI","2.0 CDTI","Plug-in-Hybrid","Elektro"],
 "Ford":["1.0 EcoBoost","1.5 EcoBoost","1.6 EcoBoost","2.0 EcoBoost","1.5 TDCi","1.6 TDCi","2.0 TDCi","2.0 EcoBlue","Hybrid","Plug-in-Hybrid","Elektro"],
 "Toyota":["1.0 VVT-i","1.3 VVT-i","1.5 VVT-i","1.6 VVT-i","1.8 Hybrid","2.0 Hybrid","2.5 Hybrid","2.0 Benzin","2.5 Benzin","Elektro"],
 "Renault":["0.9 TCe","1.0 TCe","1.2 TCe","1.3 TCe","1.6 Benzin","1.5 dCi","1.6 dCi","2.0 dCi","E-Tech Hybrid","Elektro"],
 "Peugeot":["1.2 PureTech","1.6 PureTech","1.4 HDi","1.5 BlueHDi","1.6 HDi","2.0 HDi","Hybrid","Plug-in-Hybrid","Elektro"],
 "Hyundai":["1.0 T-GDI","1.4 T-GDI","1.5 T-GDI","1.6 GDI","1.6 T-GDI","1.6 CRDi","2.0 CRDi","Hybrid","Plug-in-Hybrid","Elektro"],
 "Kia":["1.0 T-GDI","1.4 T-GDI","1.5 T-GDI","1.6 GDI","1.6 T-GDI","1.6 CRDi","2.0 CRDi","Hybrid","Plug-in-Hybrid","Elektro"],
 "Fiat":["0.9 TwinAir","1.0 FireFly","1.2 Benzin","1.4 Benzin","1.3 Multijet","1.6 Multijet","2.0 Multijet","Elektro"],
 "Tesla":["Elektro Standard Range","Elektro Long Range","Elektro Performance"],
 "Porsche":["2.0 Turbo","2.5 Turbo","3.0 V6","4.0 V8","Hybrid","Plug-in-Hybrid","Elektro"]
};
let engineRequest=0;
function loadEngines(preferred){
 const el=$("engine"),custom=$("engineCustom"),make=$("make").value,
 model=$("model").value,year=$("year").value;
 if(!el)return [];
 const request=++engineRequest;
 const basic=[...new Set([...(ENGINE_BY_BRAND[make]||[]),...COMMON_ENGINES])];
 const requested=typeof preferred==="string"?preferred:chosenEngine();
 function paint(specific=[],desired=""){
  const variants=specific.map(r=>r.designation);
  const safe=s=>esc(s);
  el.innerHTML='<option value="">Motor auswählen / Select engine</option>'+
   (variants.length?'<optgroup label="Herstellerangaben – genaue Ausstattung prüfen">'+
    variants.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join("")+'</optgroup>':"")+
   '<optgroup label="Allgemeine Motorvarianten – nicht fitmentgeprüft">'+
    basic.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join("")+'</optgroup>';
  if(variants.includes(desired)||basic.includes(desired)){
   el.value=desired;
   if(custom&&custom.value===desired)custom.value="";
  }else if(desired){
   el.value="Andere Motorisierung (selbst eingeben)";
   if(custom&&!custom.value)custom.value=desired;
  }else el.value="";
  el.disabled=false;
 }
 paint([],requested);
 if(make&&model&&year&&window.CarPartsDB?.getEngines){
  window.CarPartsDB.getEngines(make,model,year).then(rows=>{
   if(request!==engineRequest||$("make").value!==make||
      $("model").value!==model||$("year").value!==year)return;
   const current=chosenEngine()||requested;
   paint(rows,current);
  }).catch(()=>{}); // Keep the working local engine list offline.
 }
 return basic;
}
function chosenEngine(){return $("engineCustom")?.value.trim()||$("engine").value}
function setOptionSelect(id,value,placeholder){const el=$(id);if(!el)return;el.innerHTML='<option value="">'+placeholder+'</option>'+(value?'<option value="'+String(value).replaceAll('"','&quot;')+'">'+value+'</option>':'');if(value)el.value=value}
function vehicleProfileFromVin(rows){const get=k=>(rows.find(x=>x.Variable===k)||{}).Value||"";return {make:get("Make"),model:get("Model"),year:get("Model Year"),engine:get("Engine Model")||get("Engine Configuration")||get("Displacement (L)"),fuel:get("Fuel Type - Primary"),drive:get("Drive Type"),body:get("Body Class"),doors:get("Doors"),trim:get("Trim")}}
function applyVehicleProfile(p){if(p.make){const opt=[...$("make").options].find(o=>o.value.toLowerCase()===p.make.toLowerCase());$("make").value=opt?opt.value:p.make}if(p.year){$("year").value=p.year}return loadModels().then(()=>{if(p.model)$("model").value=p.model;loadEngines(p.engine||"");if(p.body)$("variant").value=[p.body,p.trim].filter(Boolean).join(" · ");vehicleChanged()})}
function vehicleChanged(){++catalogRequest;const make=$("make").value,model=$("model").value,year=$("year").value,engine=$("engine").value,variant=$("variant").value;const score=(make?25:0)+(model?25:0)+(year?15:0)+(engine?20:0)+(variant?5:0)+($("vin").value.trim().length===17?10:0);$("fitmentScore").textContent=score+"/100";$("fitmentScore").className="fitment-score "+(score>=90?"ready":score>=70?"good":"needs");if(make&&model&&year){state.vehicle={make,model,year,engine,variant,vin:$("vin").value.trim()};$("vehicleName").textContent=make+" "+model;$("vehicleSub").textContent=(engine||"Engine not confirmed")+" · "+year;$("vehicleStatus").textContent="UNVERIFIED";$("confirmTitle").textContent=make+" "+model+" · "+year;$("confirmText").textContent="Vehicle details collected. Exact part fitment must be verified by catalog data.";renderResults()}else{$("vehicleStatus").textContent="NOT SELECTED";$("confirmTitle").textContent="No vehicle selected";$("confirmText").textContent="Select make, model and year to build a fitment profile.";$("fitmentScore").textContent="0%"}}
function icon(s){if(s==="pad")return '<svg viewBox="0 0 120 100"><path d="M25 15h70v70H25z" fill="#252d34"/><path d="M35 25h50v50H35z" fill="#cbd2d7"/><path d="M44 34h32v32H44z" fill="#252d34"/></svg>';if(s==="light")return '<svg viewBox="0 0 120 100"><path d="M15 50c8-27 25-39 50-39h27l13 39-13 39H65c-25 0-42-12-50-39Z" fill="#dbe1e5" stroke="#68747e" stroke-width="3"/><path d="M35 28c18 3 34 10 50 22-16 12-32 19-50 22 7-15 7-29 0-44Z" fill="#fff"/></svg>';return '<svg viewBox="0 0 120 100"><rect x="27" y="17" width="66" height="66" rx="8" fill="#303a43"/><rect x="36" y="27" width="48" height="45" rx="5" fill="#dce1e5"/><path d="M43 38h34M43 47h34M43 56h34M43 65h20" stroke="#8a969f" stroke-width="4"/></svg>'}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function setCatalogStatus(status){
 const el=$("catalogStatus");if(!el)return;
 el.classList.toggle("live",status==="ready");
 const label=el.querySelector("span:last-child");if(!label)return;
 label.textContent=status==="ready"?"Artikel mit Quellenbeleg · Ausstattung prüfen":
 status==="loading"?"Durchsuche den CarParts-Katalog…":
 status==="error"?"Teilekatalog nicht erreichbar":
 status==="empty"?"Noch keine belegten Angebote für diese Auswahl":"CarParts Teilekatalog · Suchergebnisse direkt auf dieser Seite";
}
function placeholderPartImage(){
 // Self-created illustration, not a photo or representation of any particular SKU.
 return '<svg aria-hidden="true" viewBox="0 0 250 170" xmlns="http://www.w3.org/2000/svg">'+
 '<ellipse cx="125" cy="145" rx="74" ry="11" fill="#000" opacity=".09"/>'+
 '<g transform="translate(62 16)">'+
 '<rect x="18" y="24" width="106" height="94" rx="14" fill="#c9d1d9" stroke="#718494" stroke-width="3"/>'+
 '<rect x="28" y="34" width="86" height="73" rx="8" fill="#e9edf1" stroke="#8795a3" stroke-width="2"/>'+
 '<path d="M40 34v73M53 34v73M66 34v73M79 34v73M92 34v73M105 34v73" stroke="#9aabb7" stroke-width="4"/>'+
 '<ellipse cx="71" cy="25" rx="53" ry="13" fill="#edf1f5" stroke="#728391" stroke-width="3"/>'+
 '<ellipse cx="71" cy="25" rx="22" ry="7" fill="#607381"/>'+
 '<ellipse cx="71" cy="115" rx="53" ry="11" fill="#b4c0ca" stroke="#728391" stroke-width="3"/>'+
 '</g></svg>';
}
function inlineCatalogEmpty(term,unavailable=false){
 const title=unavailable?"Teilekatalog aktuell nicht erreichbar":
  "Für diese Fahrzeugauswahl noch keine belegten Artikel";
 const details=unavailable?
  "Die Datenbankanfrage hat nicht funktioniert. Es werden keine geschätzten Angebote angezeigt.":
  "CarParts hat für diesen Suchbegriff und diese genaue Motorvariante noch keinen überprüften Teile-Datensatz. Wir zeigen bewusst keine erfundenen Preise oder unbestätigte Passformen.";
 $("resultsTitle").textContent="Teilesuche · "+(state.vehicle?state.vehicle.make+" "+state.vehicle.model:"CarParts");
 $("resultsGrid").innerHTML='<div class="catalog-empty"><div class="catalog-empty-icon">⌕</div><h3>'+title+
  '</h3><p>'+details+'</p><div class="catalog-empty-query">Suchbegriff: <strong>'+esc(term)+
  '</strong></div><p class="catalog-empty-tip">Tipp: Motorcode, Baujahr und genaue Teilebezeichnung helfen, den Artikel einzugrenzen.</p></div>';
 setCatalogStatus(unavailable?"error":"empty");
}
function renderResultsInternal(term){
 $("resultsTitle").textContent=state.vehicle?"Teile im CarParts-Katalog für "+state.vehicle.make+" "+state.vehicle.model:
  "Wähle zuerst ein Fahrzeug";
 $("resultsGrid").innerHTML='<div class="empty-results">'+(state.vehicle?
  "Suche nach einem Ersatzteil. Gefundene geprüfte Artikel erscheinen hier direkt mit Foto, Preis und Quelle, soweit diese Daten vorliegen.":
  "Wähle Marke, Modell und Baujahr, um Ersatzteile auf dieser Seite zu suchen.")+'</div>';
 setCatalogStatus("initial");
}
let catalogRequest=0;
function renderSupabaseCards(rows,term){
 $("resultsTitle").textContent="Ersatzteile für "+state.vehicle.make+" "+state.vehicle.model;
 const intro='<div class="catalog-grid-heading"><h3>'+rows.length+' belegte'+(rows.length===1?"r Artikel":" Artikel")+
  ' im CarParts-Katalog</h3><p>Nur für die gewählte genaue Ausführung mit Herstellerbeleg. Ausstattung und Teilenummer vor dem Kauf vergleichen.</p></div>';
 const cards=rows.map(p=>{
  const validUrl=x=>typeof x==="string"&&/^https:\/\//i.test(x);
  const img=Array.isArray(p.images)?p.images.find(x=>validUrl(x.image_url)):null;
  const image=img?'<img loading="lazy" decoding="async" src="'+esc(img.image_url)+'" alt="'+esc(img.alt_text||p.part_name)+'">':
   placeholderPartImage();
  const imageBadge=img?"Freigegebenes Produktbild":"Symbolillustration · kein Produktfoto";
  const offers=Array.isArray(p.offers)?p.offers.filter(x=>Number.isFinite(Number(x.price_amount))&&
   Number(x.price_amount)>=0&&/^[A-Z]{3}$/.test(x.currency)): [];
  const best=offers.length?offers.slice().sort((a,b)=>Number(a.price_amount)-Number(b.price_amount))[0]:null;
  let priceMarkup='<div class="catalog-item-price unavailable"><strong>Preis nicht verfügbar</strong>'+
   '<span>Noch kein geprüfter Händlerpreis</span></div>';
  if(best){
   let price;try{price=new Intl.NumberFormat("de-DE",{style:"currency",currency:best.currency}).format(Number(best.price_amount))}
   catch(e){price=Number(best.price_amount).toFixed(2)+" "+best.currency}
   const when=Number.isFinite(Date.parse(best.observed_at))?
    new Date(best.observed_at).toLocaleDateString("de-DE"):"";
   priceMarkup='<div class="catalog-item-price"><strong>'+esc(price)+'</strong>'+
    '<span>von '+esc(best.merchant_name)+(when?' · Stand '+esc(when):'')+'</span></div>';
  }
  const source=validUrl(p.source_url)?'<a class="catalog-evidence" href="'+esc(p.source_url)+
   '" target="_blank" rel="noopener noreferrer">Herstellerbeleg ↗</a>':"";
  const shop=best&&validUrl(best.product_url)?'<a class="catalog-buy" href="'+esc(best.product_url)+
   '" target="_blank" rel="noopener noreferrer">Händlerangebot ansehen ↗</a>':"";
  return '<article class="catalog-item">'+
   '<div class="catalog-item-visual">'+image+'<span>'+imageBadge+'</span></div>'+
   '<div class="catalog-item-body"><span class="catalog-item-status">✓ Herstelleranwendung belegt · Bedingungen prüfen</span>'+
   '<h3>'+esc(p.part_name)+'</h3><p class="catalog-item-maker">'+esc(p.manufacturer)+
   ' · Art.-Nr. '+esc(p.manufacturer_part_number)+'</p>'+
   '<p class="catalog-item-engine">Ausführung: '+esc(p.engine)+'</p>'+
   '<p class="catalog-item-warning">'+esc(p.fitment?.notes||"Vor Kauf am Fahrzeug überprüfen.")+'</p>'+
   priceMarkup+'<div class="catalog-item-actions">'+source+shop+'</div></div></article>';
 }).join("");
 $("resultsGrid").innerHTML=intro+'<div class="catalog-item-grid">'+cards+'</div>';
 setCatalogStatus("ready");
}
async function renderSupabaseResults(term,requestId){
 setCatalogStatus("loading");
 $("resultsGrid").innerHTML='<div class="empty-results">Suche geprüfte Teile im CarParts-Katalog…</div>';
 try{
  const rows=await window.CarPartsDB.findVerifiedParts({...state.vehicle},term);
  if(requestId!==catalogRequest)return false;
  if(rows.length)renderSupabaseCards(rows,term);
  else inlineCatalogEmpty(term,false);
  return true;
 }catch(e){
  if(requestId!==catalogRequest)return false;
  inlineCatalogEmpty(term,true);
  return false;
 }
}
async function renderLiveResults(term){const requestId=++catalogRequest;if(!state.vehicle)return false;
if(window.CarPartsDB && (!window.CarPartsCatalog||!window.CARPARTS_CATALOG_CONFIG?.baseUrl)){return renderSupabaseResults(term,requestId)}
if(!window.CarPartsCatalog||!window.CARPARTS_CATALOG_CONFIG?.baseUrl){inlineCatalogEmpty(term,true);return false}
setCatalogStatus("loading");
$("resultsGrid").innerHTML='<div class="empty-results">Searching verified catalog data…</div>';
try{
 const rows=await window.CarPartsCatalog.search({vehicle:state.vehicle,query:term,mode:state.mode});
 if(requestId!==catalogRequest)return false;
 if(!Array.isArray(rows))throw Error("Invalid catalog response");
 setCatalogStatus("ready");
 $("resultsTitle").textContent="Real catalog results for "+state.vehicle.make+" "+state.vehicle.model;
 if(!rows.length){$("resultsGrid").innerHTML='<div class="empty-results">No matching catalog records found. Try an OE number, article number or more exact vehicle details.</div>';return true}
 $("resultsGrid").innerHTML=rows.map((p,i)=>{
 const fit=p.fitment||{},confirmed=fit.status==="confirmed"||fit.status==="exact";
 const oe=Array.isArray(p.oeNumbers)?p.oeNumbers:[],refs=Array.isArray(p.crossReferences)?p.crossReferences:[];
 const price=typeof p.price==="number"&&Number.isFinite(p.price)?new Intl.NumberFormat(state.lang==="de"?"de-DE":"en-DE",{style:"currency",currency:p.currency||"EUR"}).format(p.price):"Price unavailable";
 return '<article class="part-card"><div class="match '+(confirmed?"":"warn")+'">'+(confirmed?"✓ Catalog fit verified":"⚠ Fitment not verified")+'</div><div class="part-visual">'+icon(p.type||"filter")+'</div><h3>'+esc(p.name)+'</h3><div class="meta">'+esc(p.brand)+' · '+esc(p.articleNumber)+'</div><div class="oe-line"><strong>OE:</strong> '+esc(oe.join(", ")||"Not supplied")+'</div><div class="oe-line"><strong>Cross references:</strong> '+esc(refs.join(", ")||"Not supplied")+'</div><div class="supplier">'+esc(p.seller||"Seller unavailable")+' · '+esc(p.availability||"Availability unknown")+'</div><div class="price-row"><div class="price">'+esc(price)+'</div><button class="view-btn" data-live-index="'+i+'">Details</button></div></article>';
 }).join("");
 document.querySelectorAll("[data-live-index]").forEach(btn=>btn.onclick=()=>{
 const p=rows[Number(btn.dataset.liveIndex)],fit=p.fitment||{};
 const link=typeof p.url==="string"&&/^https:\/\//i.test(p.url)?'<p><a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">View at seller</a></p>':"";
 openModal("<h2>"+esc(p.name)+"</h2><p>"+esc(p.brand)+" · "+esc(p.articleNumber)+"</p><p><strong>OE numbers:</strong> "+esc((p.oeNumbers||[]).join(", ")||"Not supplied")+"</p><p><strong>Cross references:</strong> "+esc((p.crossReferences||[]).join(", ")||"Not supplied")+"</p><p><strong>Fitment:</strong> "+esc(fit.status||"Unverified")+"</p><p>"+esc(fit.reason||"Check fitment with the supplier before purchase.")+"</p><p><strong>Seller:</strong> "+esc(p.seller||"Not supplied")+"</p>"+link)
 });
 return true;
}catch(e){if(requestId!==catalogRequest)return false;setCatalogStatus("error");$("resultsGrid").innerHTML='<div class="empty-results">The catalog could not be reached. No substitute or demo results are shown.</div>';return false}
}
function renderResults(){renderResultsInternal($("partSearch").value.trim())}
async function search(){const q=$("partSearch").value.trim();if(!state.vehicle){show("Select brand, model and year first.");$("finder").scrollIntoView({behavior:"smooth"});return}if(!q){show("Enter a part name or OE number.");return}await renderLiveResults(q);$("parts").scrollIntoView({behavior:"smooth"})}
$("make").onchange=async()=>{$("model").value="";$("engine").value="";$("engineCustom").value="";await loadModels();loadEngines();vehicleChanged()};$("year").onchange=async()=>{await loadModels();loadEngines();vehicleChanged()};$("model").oninput=()=>{loadEngines();vehicleChanged()};$("model").onchange=()=>{loadEngines();vehicleChanged()};$("engine").onchange=()=>{$("engineCustom").value="";vehicleChanged()};$("engineCustom").oninput=vehicleChanged;$("variant").oninput=vehicleChanged;
$("vin").addEventListener("change",()=>{const v=$("vin").value.trim();if(v)decodeVin(v)});$("searchBtn").onclick=search;$("partSearch").addEventListener("keydown",e=>{if(e.key==="Enter")search()});document.querySelectorAll(".quick-tags button").forEach(b=>b.onclick=()=>{$("partSearch").value=b.dataset.part;search()});
document.querySelectorAll(".quality-toggle button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".quality-toggle button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.mode=b.dataset.mode;const q=$("partSearch").value.trim();if(q&&state.vehicle)renderLiveResults(q);else renderResults()});
$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("cp-dark",document.body.classList.contains("dark"));$("themeBtn").firstChild.textContent=document.body.classList.contains("dark")?"☀ ":"☾ ";$("themeBtn").lastChild.textContent=state.lang==="de"?(document.body.classList.contains("dark")?"Hell":"Dunkel"):(document.body.classList.contains("dark")?"Light":"Dark")};
if(localStorage.getItem("cp-dark")==="true"){document.body.classList.add("dark");$("themeBtn").firstChild.textContent="☀ "}

const T={en:{how:"How it works",browse:"Browse parts",why:"Why CarParts",dark:"Dark",garage:"My garage",smart:"Smart vehicle parts search",heroTitle:"Find the right part.<br><em>First time.</em>",heroText:"Select your vehicle and search source-backed replacement parts directly on CarParts. Availability, photos and prices appear only when verified data is available.",findPart:"Find a part <span>→</span>",seeHow:"See how it works",compat:"compatibility focused",after:"and aftermarket",data:"vehicle data assisted",yourVehicle:"YOUR VEHICLE",ready:"READY",change:"Change",exactFit:"Exact fit",finder:"PART FINDER",startKnow:"Start with what you know.",finderText:"Search the live vehicle database by make, model, year and engine. You can also upload a vehicle photo or document for OCR/VIN assistance.",uploadTitle:"Upload a photo or document",uploadText:"Vehicle photo, registration document or VIN image. We'll look for readable vehicle identifiers.",choose:"Choose file",vehicleDetails:"VEHICLE DETAILS",make:"Brand",model:"Model",year:"Year",engine:"Engine",body:"Body / variant",need:"What do you need?",search:"Search",partPlaceholder:"e.g. front brake pads, oil filter…",matched:"PARTS ON CARPARTS",best:"Best value",premium:"Premium",oem:"OEM",noGuess:"NO GUESSING",confidenceTitle:"Not enough information? We'll tell you exactly what to check.",confidenceText:"If more than one variant is possible, CarParts will not pretend the fit is certain. We'll explain what is missing — such as VIN, engine code, OEM number, dimensions or a clearer photo.",example:"See an example →",howIt:"HOW IT WORKS",howTitle:"Parts shopping, without the parts knowledge.",howText:"Select your vehicle, then see available source-backed parts directly on CarParts. Exact fitment requires checking the manufacturer details.",step1:"Identify your vehicle",step1p:"Use the live vehicle database, a VIN, or upload a document/photo for identifier extraction.",step2:"Tell us what you need",step2p:"Search by part name. CarParts keeps the selected vehicle attached to the search.",step3:"Choose your match",step3p:"See sourced articles and current merchant offers when available, with missing prices clearly indicated.",built:"BUILT DIFFERENT",builtTitle:"The simple way to find vehicle parts.",f1:"Vehicle-first search",f1p:"Vehicle selection comes before part matching, reducing generic and incorrect results.",f2:"Clear compatibility",f2p:"No fake certainty. Missing fitment information is called out and explained.",f3:"Your preference, your price",f3p:"Find the cheapest good option, best value, premium quality or original parts."},de:{how:"So funktioniert's",browse:"Teile finden",why:"Warum CarParts",dark:"Dunkel",garage:"Meine Garage",smart:"Intelligente Teilesuche",heroTitle:"Das richtige Teil.<br><em>Beim ersten Mal.</em>",heroText:"Gib dein Fahrzeug und das gesuchte Teil an. CarParts sucht passende Teile — von Ersatzteilen bis zu Original-OEM-Teilen.",findPart:"Teil finden <span>→</span>",seeHow:"So funktioniert's",compat:"auf Kompatibilität fokussiert",after:"OEM & Zubehör",data:"mit Fahrzeugdaten",yourVehicle:"DEIN FAHRZEUG",ready:"BEREIT",change:"Ändern",exactFit:"Passgenau",finder:"TEILEFINDER",startKnow:"Starte mit deinen Angaben.",finderText:"Suche über die Fahrzeugdatenbank nach Marke, Modell, Baujahr und Motor. Lade alternativ ein Fahrzeugfoto oder Dokument für OCR/VIN-Erkennung hoch.",uploadTitle:"Foto oder Dokument hochladen",uploadText:"Fahrzeugfoto, Fahrzeugschein oder VIN-Bild. Wir suchen nach lesbaren Fahrzeugdaten.",choose:"Datei wählen",vehicleDetails:"FAHRZEUGDATEN",make:"Marke",model:"Modell",year:"Baujahr",engine:"Motor",body:"Karosserie / Variante",need:"Was brauchst du?",search:"Suchen",partPlaceholder:"z. B. Bremsbeläge vorne, Ölfilter…",matched:"ERSATZTEILE AUF CARPARTS",best:"Preis-Leistung",premium:"Premium",oem:"OEM",noGuess:"KEIN RATESPIEL",confidenceTitle:"Nicht genug Informationen? Wir sagen dir genau, was noch fehlt.",confidenceText:"Wenn mehrere Varianten möglich sind, behauptet CarParts nicht einfach, dass das Teil passt. Wir zeigen dir, ob VIN, Motorkennbuchstabe, OEM-Nummer, Maße oder ein klareres Foto fehlt.",example:"Beispiel ansehen →",howIt:"SO FUNKTIONIERT'S",howTitle:"Teilesuche ohne Fachwissen.",howText:"Wähle dein Fahrzeug und sieh dir belegte Ersatzteile direkt auf CarParts an. Prüfe vor dem Kauf die genaue Herstellerausführung.",step1:"Fahrzeug bestimmen",step1p:"Nutze die Live-Fahrzeugdatenbank, eine VIN oder lade ein Dokument/Fahrzeugfoto zur Erkennung hoch.",step2:"Teil angeben",step2p:"Suche nach dem Namen des Teils. Dein Fahrzeug bleibt mit der Suche verknüpft.",step3:"Passendes Teil wählen",step3p:"Vergleiche Preis-Leistung, Premium und OEM — mit klarer Kennzeichnung bei Unsicherheit.",built:"ANDERS GEDACHT",builtTitle:"Die einfache Art, Fahrzeugteile zu finden.",f1:"Fahrzeug zuerst",f1p:"Die Fahrzeugauswahl kommt vor der Teilesuche und reduziert allgemeine Fehlresultate.",f2:"Klare Kompatibilität",f2p:"Keine erfundene Sicherheit. Fehlende Angaben werden erklärt.",f3:"Deine Wahl, dein Preis",f3p:"Günstig und gut, beste Preis-Leistung, Premium oder Originalteil."}};
function applyLang(){const d=T[state.lang];document.querySelectorAll("[data-i18n]").forEach(el=>{const k=el.dataset.i18n;if(d[k]!=null)el.innerHTML=d[k]});document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=d[el.dataset.i18nPlaceholder]);$("langBtn").textContent=state.lang==="en"?"DE":"EN";$("themeBtn").lastChild.textContent=state.lang==="de"?(document.body.classList.contains("dark")?"Hell":"Dunkel"):(document.body.classList.contains("dark")?"Light":"Dark");localStorage.setItem("cp-lang",state.lang)}
$("langBtn").onclick=()=>{state.lang=state.lang==="en"?"de":"en";applyLang()};applyLang();

$("uploadBtn").onclick=()=>$("photoInput").click();document.querySelector(".upload-card").onclick=e=>{if(e.target.closest("button"))return;$("photoInput").click()};
$("photoInput").onchange=async()=>{const f=$("photoInput").files[0];if(!f)return;const url=URL.createObjectURL(f);$("preview").style.display="block";$("preview").innerHTML=f.type.startsWith("image/")?'<img src="'+url+'" alt="Uploaded vehicle document/photo">':'<div style="padding:12px;font-size:11px">PDF selected</div>';$("scanProgress").textContent="Reading vehicle identifiers…";try{if(window.Tesseract&&f.type.startsWith("image/")){const r=await Tesseract.recognize(f,"eng");const text=r.data.text||"";const vin=(text.toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/)||[])[0];if(vin){$("vin").value=vin;$("scanProgress").textContent="VIN found. Decoding vehicle…";await decodeVin(vin)}else{$("scanProgress").textContent="No reliable 17-character VIN found. Please enter the VIN or choose vehicle details manually.";show("We could not reach a 100% identification from this image. Please verify the vehicle details.")}}else{$("scanProgress").textContent="PDF selected. Browser OCR is image-based; use a clear screenshot/photo of the vehicle data for automatic extraction."}}catch(e){$("scanProgress").textContent="Identification could not be confirmed. Please verify manually.";show("No 100% match found. Please verify the vehicle.")}};
async function decodeVin(vin){vin=String(vin||"").trim().toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)){show("Please enter a valid 17-character VIN.");return}try{const d=await api("/DecodeVinValues/"+encodeURIComponent(vin)+"?format=json");const rows=d.Results||[];const p=vehicleProfileFromVin(rows);if(!p.make||!p.model||!p.year)throw Error("Incomplete VIN profile");await applyVehicleProfile(p);$("vin").value=vin;$("scanProgress").textContent="VIN decoded. Review the detected vehicle before searching parts.";show("VIN decoded — review the vehicle profile before searching parts.")}catch(e){show("VIN could not be fully decoded. Please verify the VIN and vehicle details manually.")}}

$("learnBtn").onclick=()=>show("For a 100% fit, use the VIN or OEM part number. If still uncertain, check the engine code and compare the old part's dimensions/connectors.");
$("changeVehicle").onclick=()=>$("finder").scrollIntoView({behavior:"smooth"});function openModal(content){$("modalContent").innerHTML=content;$("modalBackdrop").classList.add("open")}function closeModal(){$("modalBackdrop").classList.remove("open")}$("modalClose").onclick=closeModal;$("modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")closeModal()};
function saveGarage(){if(!state.vehicle){show(state.lang==="de"?"Bitte zuerst ein Fahrzeug auswählen.":"Select a vehicle first.");return}const key=JSON.stringify(state.vehicle);if(!state.garage.some(x=>JSON.stringify(x)===key)){state.garage.push(state.vehicle);localStorage.setItem("cp-garage",JSON.stringify(state.garage))}updateGarageCount();show(state.lang==="de"?"Fahrzeug zur Garage hinzugefügt.":"Vehicle added to your garage.")}
function updateGarageCount(){const el=document.querySelector("#garageBtn span");if(el)el.textContent=state.garage.length}
function openGarage(){const title=state.lang==="de"?"Meine Garage":"My garage";const empty=state.lang==="de"?"Noch keine Fahrzeuge gespeichert.":"No vehicles saved yet.";let content="<h2>"+title+"</h2>";if(!state.garage.length)content+="<p>"+empty+"</p>";else{content+="<div class='garage-list'>"+state.garage.map((v,i)=>"<div class='garage-item'><div><strong>"+v.make+" "+v.model+"</strong><br><small>"+v.year+(v.engine?" · "+v.engine:"")+"</small></div><button data-garage='"+i+"'>"+(state.lang==="de"?"Auswählen":"Select")+"</button></div>").join("")+"</div>"}openModal(content);document.querySelectorAll("[data-garage]").forEach(b=>b.onclick=()=>{const v=state.garage[Number(b.dataset.garage)];$("make").value=[...$("make").options].find(o=>o.value===v.make)?.value||v.make;$("year").value=v.year;loadModels().then(()=>{$("model").value=v.model;loadEngines(v.engine||"");vehicleChanged();closeModal();$("finder").scrollIntoView({behavior:"smooth"})})})}
$("garageBtn").onclick=()=>openGarage();updateGarageCount();
years();loadMakes();loadEngines();renderResults();