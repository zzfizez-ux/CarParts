import "./supabase-catalog.js?v=31";
import {availableSeries, displayModel, loadSeries, selectedSeries, seriesEngines, updateSeriesYears, years} from "./vehicle-series.js?v=27";
import {seriesEvidence} from "./supabase/functions/live-web-search/vehicle-fitment.mjs?v=27";

const API="https://vpic.nhtsa.dot.gov/api/vehicles";
const CATALOG_DEMO=false;
const hasSeries = !!document.getElementById("series");
const modelIndex = window.CarPartsModelIndex || {};
const POPULAR_MAKES = [...new Set([...Object.keys(window.CARPARTS_POPULAR_MODELS || {}), ...Object.keys(modelIndex)])]
 .filter(name => !["Mini","DS Automobiles"].includes(name)).sort((a,b)=>a.localeCompare(b,"de"));
function preference(key,fallback=""){
 try{return localStorage.getItem(key)??fallback}catch{return fallback}
}
function storePreference(key,value){
 try{localStorage.setItem(key,value);return true}catch{return false}
}
const state={mode:"value",lang:preference("cp-lang")==="de"?"de":"en",vehicle:null,garage:(()=>{try{return JSON.parse(preference("cp-garage","[]"))}catch{return []}})()};
// Never persist VINs: remove any VIN previously saved by older CarParts versions.
const savedText=value=>typeof value==="string"?value:"";
state.garage=Array.isArray(state.garage)?state.garage.filter(v=>savedText(v?.make)&&savedText(v.model)).map(v=>({
 make:v.make,model:v.model,year:v.year,engine:savedText(v.engine),variant:savedText(v.variant),series:savedText(v.series)
})):[];
storePreference("cp-garage",JSON.stringify(state.garage));
const $=id=>document.getElementById(id),toastEl=$("toast");
function show(m){toastEl.textContent=m;toastEl.classList.add("show");clearTimeout(window.__t);window.__t=setTimeout(()=>toastEl.classList.remove("show"),3000)}
function api(path){return fetch(API+path,{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error("API");return r.json()})}
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
 sourceStatus("Fahrzeugkatalog · "+POPULAR_MAKES.length+" Marken");
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
 const names=[...(modelIndex[make]?.models||[]).map(name=>displayModel(make,name)),...(key?catalog[key].split(","):[])];
 const fallback=[...new Map(names.map(name=>[name.toLowerCase(),name])).values()].sort((a,b)=>a.localeCompare(b,"de",{numeric:true}));
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
  if(request!==modelRequest||$("make").value!==make)return fallback;
  const seen=new Set(fallback.map(name=>name.toLowerCase()));
  const combined=fallback.concat(names.filter(name=>!seen.has(name.toLowerCase())));
  renderOptions(combined);
  sourceStatus(combined.length+" Modelle · "+make);
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
 const series=hasSeries?selectedSeries():"";
 const request=++engineRequest;
 const listed=hasSeries && seriesEngines(make,model,$("series").value,year);
 const basic=listed?.length?[...new Set([...listed,"Andere Motorisierung (selbst eingeben)"])]:[...new Set([...(ENGINE_BY_BRAND[make]||[]),...COMMON_ENGINES])];
 const requested=typeof preferred==="string"?preferred:chosenEngine();
 function paint(specific=[],desired=""){
  const variants=specific.map(r=>r.designation);
  const safe=s=>esc(s);
  el.innerHTML='<option value="">Motor auswählen / Select engine</option>'+
   (variants.length?'<optgroup label="Herstellerangaben – genaue Ausstattung prüfen">'+
    variants.map(x=>'<option value="'+safe(x)+'">'+safe(x)+'</option>').join("")+'</optgroup>':"")+
   '<optgroup label="'+(listed?.length?"Motorisierungen der Baureihe":"Allgemeine Motorvarianten")+' – Ausstattung prüfen">'+
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
 if(make&&model&&year&&series&&window.CarPartsDB?.getEngines){
  window.CarPartsDB.getEngines(make,model,year,series).then(rows=>{
   if(request!==engineRequest||$("make").value!==make||
      $("model").value!==model||$("year").value!==year||selectedSeries()!==series)return;
   const current=chosenEngine()||requested;
   paint(rows,current);
  }).catch(()=>{}); // Keep the working local engine list offline.
 }
 return basic;
}
function chosenEngine(){return $("engineCustom")?.value.trim()||($("engine").value==="Andere Motorisierung (selbst eingeben)"?"":$("engine").value)}
// NHTSA VIN parsing is handled in the separately tested vin-check.js module.
async function applyVinVehicleProfile(p,force=false){
 if(!p?.make)return false;
 const oldMake=$("make").value,oldModel=$("model").value;
 const makes=[...$("make").options];
 const match=makes.find(o=>o.value&&window.CarPartsVIN.makeKey(o.value)===window.CarPartsVIN.makeKey(p.make));
 if(!match)return false; // Never inject unsupported models or brands.
 if(force||!$("make").value){
  if($("make").value!==match.value){
   $("make").value=match.value;$("model").value="";await loadModels();
  }
 }
 if($("make").value===match.value&&p.model&&(force||!$("model").value)){
  const model=[...$("model").options].find(o=>o.value&&window.CarPartsVIN.matchesModel(o.value,p.model)===true);
  if(model)$("model").value=model.value;
  else if(force)$("model").value="";
 }
 if(hasSeries&&(oldMake!==$("make").value||oldModel!==$("model").value))await loadSeries();
 if(p.year&&(force||!$("year").value)){
  if([...$("year").options].some(o=>o.value===String(p.year)))$("year").value=String(p.year);
  else if(force)$("year").value="";
 }
 if(force){$("engine").value="";$("engineCustom").value=""}
 loadEngines();
 vehicleChanged();
 return true;
}
let coverageRequest=0;
function updatePartsCoverage(){
 const el=$("partsCoverage");if(!el)return;
 const make=$("make").value,model=$("model").value,year=$("year").value;
 const series=hasSeries?selectedSeries():"";
 const request=++coverageRequest;
 if(!make||!model||!year||!series){el.textContent="Katalogabdeckung nach der Fahrzeugauswahl.";return}
 el.textContent="Prüfe Herstelleranwendungen für diese Baureihe…";
 if(!window.CarPartsDB?.getCoverage){el.textContent="Teilekatalog derzeit nicht verbunden.";return}
 window.CarPartsDB.getCoverage(make,model,year,series).then(c=>{
  if(request!==coverageRequest||$("make").value!==make||$("model").value!==model||$("year").value!==year||selectedSeries()!==series)return;
  el.textContent=c.verifiedArticles
   ?c.verifiedArticles+" Artikel mit Herstelleranwendung in dieser Baureihe."
   :"Für diese Baureihe und dieses Baujahr liegen keine Kataloganwendungen vor.";
 }).catch(()=>{if(request===coverageRequest)el.textContent="Teileabdeckung gerade nicht abrufbar."});
}
let registryEvidenceRequest=0;
function updateRegistryEvidence(){
 const el=$("registryEvidence");if(!el)return;
 const make=$("make").value,model=$("model").value,year=Number($("year").value);
 const ticket=++registryEvidenceRequest;
 if(!make||!model){
  el.textContent="Offene Fahrzeugregister: nach der Modellauswahl verfügbar.";
  el.className="registry-evidence";return;
 }
 el.className="registry-evidence";
 el.textContent="Prüfe die Modellbezeichnung in offenen amtlichen Fahrzeugregistern…";
 if(!window.CarPartsDB?.getRegistryEvidence)return;
 window.CarPartsDB.getRegistryEvidence(make,model).then(entry=>{
  if(ticket!==registryEvidenceRequest||$("make").value!==make||$("model").value!==model)return;
  if(!entry){
   el.textContent="Für diese Modellschreibweise kein eindeutiger offener Registerbeleg – keine Aussage zur Passform.";
   return;
  }
  const first=Number(entry.model_first_year)||null,last=Number(entry.model_last_year)||null;
  const notYet=(first&&year&&year<first)||(last&&year&&year>last);
  if(notYet){
   el.textContent="⚠ Modelljahr prüfen: Die offene Quelle dokumentiert diese Modellreihe"+
    (first?" ab "+first:"")+(last?" bis "+last:"")+
    ". Keine automatische Passform- oder Baujahrgarantie.";
   el.className="registry-evidence registry-warning";return;
  }
  el.textContent=(entry.german_registration?"✓ Modellreihe in deutschen Registern belegt. ":"✓ Modellreihe in offenen Länderregistern belegt. ")+
   "Keine bestätigte Ersatzteilpassform. Quelle: VehiclesDB · CC BY 4.0.";
  el.className="registry-evidence registry-sourced";
 }).catch(()=>{
  if(ticket===registryEvidenceRequest)el.textContent="Offene Register gerade nicht abrufbar. Fahrzeugeingabe bleibt nutzbar.";
 });
}
let vinCheckSequence=0;
let vinResult={status:"idle",vin:"",decoded:null,local:null,reason:""};
function vinInput(){return window.CarPartsVIN.check($("vin").value)}
function vinFields(){return {make:$("make").value,model:$("model").value,year:$("year").value}}
function updateVinUI(){
 const el=$("vinStatus"),apply=$("vinApplyBtn"),v=vinResult;
 if(!el)return;
 let message=v.reason||"Fahrgestellnummer optional. VIN prüfen für den Abgleich mit Fahrzeugdaten.";
 if(v.status==="matched")message="✓ VIN-Stammdaten stimmen mit Marke, Modell und Modelljahr überein. Das bestätigt keine Teilepassform. "+(v.local?.checksumText||"");
 if(v.status==="checking")message="Prüfe die VIN mit der öffentlichen NHTSA-Fahrzeugdatenbank…";
 if(v.status==="unchecked")message="VIN noch nicht geprüft. Klicke „VIN prüfen“; 17 Zeichen allein bedeuten keine Verifizierung.";
 if(v.status==="invalid")message="✕ "+v.reason;
 if(v.status==="mismatch")message="✕ VIN widerspricht der Fahrzeugauswahl: "+v.conflicts.join(", ")+
  ". Bitte die Auswahl korrigieren oder die VIN-Daten übernehmen. Suche gesperrt.";
 if(v.status==="partial")message="⚠ VIN-Prüfung nur teilweise möglich: "+(v.reason||"Fahrzeugdaten oder Prüfziffer nicht eindeutig.")+
  " Herstellerdaten und Fahrzeugunterlagen vor Bestellung abgleichen.";
 if(v.status==="unavailable")message="⚠ Die VIN-Datenbank ist nicht erreichbar. Fahrzeugangaben sind NICHT VIN-bestätigt.";
 el.textContent=message;
 el.className="vin-status vin-"+v.status;
 if(apply)apply.hidden=!(v.decoded&&v.status==="mismatch");
}
function refreshVinComparison(){
 const raw=vinInput();
 if(!raw.vin){
  vinResult={status:"idle",vin:"",decoded:null,local:null,reason:""};updateVinUI();return;
 }
 if(raw.vin!==vinResult.vin){
  vinResult={status:"unchecked",vin:raw.vin,decoded:null,local:raw,reason:""};updateVinUI();return;
 }
 if(vinResult.status==="invalid"||vinResult.status==="checking"||
  vinResult.status==="unchecked"||vinResult.status==="unavailable"){
  updateVinUI();return;
 }
 if(!vinResult.decoded){updateVinUI();return}
 const comparison=window.CarPartsVIN.compare(vinResult.decoded,vinFields());
 vinResult.conflicts=comparison.conflicts;
 if(comparison.conflicts.length)vinResult.status="mismatch";
 else if(comparison.confirmed.length===3&&vinResult.local?.checkdigitValid&&
   (!vinResult.decoded.errorCode||/^(0|0,10)$/.test(vinResult.decoded.errorCode.trim()))){
  vinResult.status="matched";
 }else{
  vinResult.status="partial";
  vinResult.reason=comparison.uncertain.length?
   "Nicht eindeutig: "+comparison.uncertain.join(", ")+".":vinResult.local?.checksumText||"Fahrzeugdaten nur teilweise bestätigt.";
 }
 updateVinUI();
}
function vehicleLabel(vehicle){
 const {make,model,series}=vehicle;
 const generation=series?.toLowerCase().startsWith(model.toLowerCase()+" ")?series:[model,series].filter(Boolean).join(" ");
 return make+" "+generation;
}
function vehicleChanged(){
 updatePartsCoverage();updateRegistryEvidence();++catalogRequest;refreshVinComparison();
 const make=$("make").value,model=$("model").value,year=$("year").value,
  engine=chosenEngine(),variant=$("variant").value;
 const score=(make?25:0)+(model?25:0)+(year?15:0)+(engine?20:0)+(variant?5:0)+
  (vinResult.status==="matched"?10:0);
 $("fitmentScore").textContent=score+"/100";
 $("fitmentScore").className="fitment-score "+(score>=90?"ready":score>=70?"good":"needs");
 const series=hasSeries?selectedSeries():"";
 if(make&&model&&year&&(!hasSeries||series)){
  // VIN is intentionally NOT sent to Supabase or persisted to the garage.
  state.vehicle={make,model,series,year,engine,variant};
  $("vehicleName").textContent=vehicleLabel(state.vehicle);
  $("vehicleSub").textContent=(engine||"Motor nicht bestätigt")+" · "+year;
  $("vehicleStatus").textContent=vinResult.status==="mismatch"?"VIN-KONFLIKT":"UNVERIFIED";
  $("confirmTitle").textContent=vehicleLabel(state.vehicle)+" · "+year;
  $("confirmText").textContent=vinResult.status==="mismatch"?
   "VIN und Fahrzeugangaben widersprechen sich – Suche gesperrt.":
   vinResult.status==="matched"?
   "VIN-Stammdaten abgeglichen. Exakte Teilepassung und Motor-/PR-Code weiter prüfen.":
   "Fahrzeugangaben erfasst. Eine Ersatzteil-Passgarantie besteht nicht.";
  $("saveGarageBtn").disabled=vinResult.status==="mismatch";
  renderResults();
 }else{
  $("saveGarageBtn").disabled=true;
  state.vehicle=null;
  $("vehicleName").textContent="—";$("vehicleSub").textContent="";
  $("vehicleStatus").textContent="NOT SELECTED";
  $("confirmTitle").textContent="No vehicle selected";
  $("confirmText").textContent="Select make, model, chassis series and year to build a fitment profile.";
  $("fitmentScore").textContent="0%";
  renderResults();
 }
}
function icon(s){if(s==="pad")return '<svg viewBox="0 0 120 100"><path d="M25 15h70v70H25z" fill="#252d34"/><path d="M35 25h50v50H35z" fill="#cbd2d7"/><path d="M44 34h32v32H44z" fill="#252d34"/></svg>';if(s==="light")return '<svg viewBox="0 0 120 100"><path d="M15 50c8-27 25-39 50-39h27l13 39-13 39H65c-25 0-42-12-50-39Z" fill="#dbe1e5" stroke="#68747e" stroke-width="3"/><path d="M35 28c18 3 34 10 50 22-16 12-32 19-50 22 7-15 7-29 0-44Z" fill="#fff"/></svg>';return '<svg viewBox="0 0 120 100"><rect x="27" y="17" width="66" height="66" rx="8" fill="#303a43"/><rect x="36" y="27" width="48" height="45" rx="5" fill="#dce1e5"/><path d="M43 38h34M43 47h34M43 56h34M43 65h20" stroke="#8a969f" stroke-width="4"/></svg>'}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function setCatalogStatus(status){
 const el=$("catalogStatus");if(!el)return;
 el.classList.toggle("live",status==="ready");
 const label=el.querySelector("span:last-child");if(!label)return;
 label.textContent=status==="ready"?"Artikel mit Quellenbeleg · Ausstattung prüfen":
 status==="loading"?"Durchsuche den CarParts-Katalog…":
 status==="error"?"Teilekatalog nicht erreichbar":
 status==="empty"?"Noch keine belegten Angebote für diese Auswahl":
 status==="research"?"Recherchierte Quellen · Ausführung am Fahrzeug prüfen":
 status==="merchant"?"Händlerangebote · Ausführung am Fahrzeug prüfen":
 status==="diagnostic"?"Offene Diagnose-Bauteilhinweise · keine Teilepassform bestätigt":
 status==="community"?"Open-Data-Recherche · Teilenummern NICHT fitmentgeprüft":"CarParts Teilekatalog · Suchergebnisse direkt auf dieser Seite";
}
function placeholderPartImage(kind){
 const category=String(kind||"").toLocaleLowerCase("de-DE");
 if(category.includes("brems"))return icon("pad");
 if(category.includes("scheinwerfer")||category.includes("licht"))return icon("light");
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
 $("resultsTitle").textContent="Teilesuche · "+(state.vehicle?vehicleLabel(state.vehicle):"CarParts");
 $("resultsGrid").innerHTML='<div class="catalog-empty"><div class="catalog-empty-icon">⌕</div><h3>'+title+
  '</h3><p>'+details+'</p><div class="catalog-empty-query">Suchbegriff: <strong>'+esc(term)+
  '</strong></div><p class="catalog-empty-tip">Tipp: Motorcode, Baujahr und genaue Teilebezeichnung helfen, den Artikel einzugrenzen.</p></div>';
 setCatalogStatus(unavailable?"error":"empty");
}
function renderResultsInternal(term){
 $("sharedResearch")?.replaceChildren();
 $("resultsTitle").textContent=state.vehicle?"Teile im CarParts-Katalog für "+vehicleLabel(state.vehicle):
  "Wähle zuerst ein Fahrzeug";
 $("resultsGrid").innerHTML='<div class="empty-results">'+(state.vehicle?
  "Suche nach einem Ersatzteil. Gefundene geprüfte Artikel erscheinen hier direkt mit Foto, Preis und Quelle, soweit diese Daten vorliegen.":
  "Wähle Marke, Modell, Baureihe und Baujahr, um Ersatzteile auf dieser Seite zu suchen.")+'</div>';
 setCatalogStatus("initial");
}
let catalogRequest=0;
function renderSupabaseCards(rows,term){
 $("resultsTitle").textContent="Ersatzteile für "+vehicleLabel(state.vehicle);
 const intro='<div class="catalog-grid-heading"><h3>'+rows.length+' belegte'+(rows.length===1?"r Artikel":" Artikel")+
  ' im CarParts-Katalog</h3><p>Der Herstellerbeleg gilt für die angegebene Motoranwendung. Baureihe, Ausstattung und Teilenummer im Beleg abgleichen.</p></div>';
 const cards=rows.map(p=>{
  const validUrl=x=>typeof x==="string"&&/^https:\/\//i.test(x);
  const img=Array.isArray(p.images)?p.images.find(x=>validUrl(x.image_url)):null;
  const image=img?'<img loading="lazy" decoding="async" src="'+esc(img.image_url)+'" alt="'+esc(img.alt_text||p.part_name)+'">':
   placeholderPartImage(p.category||p.part_name);
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
  const sourceUrl=p.fitment?.source_url||p.source_url;
  const source=validUrl(sourceUrl)?'<a class="catalog-evidence" href="'+esc(sourceUrl)+
   '" target="_blank" rel="noopener noreferrer">Herstellerbeleg ↗</a>':"";
  const shop=best&&validUrl(best.product_url)?'<a class="catalog-buy" href="'+esc(best.product_url)+
   '" target="_blank" rel="noopener noreferrer">Händlerangebot ansehen ↗</a>':"";
  return '<article class="catalog-item">'+
   '<div class="catalog-item-visual">'+image+'<span>'+imageBadge+'</span></div>'+
   '<div class="catalog-item-body"><span class="catalog-item-status">'+(state.vehicle.series?'Motoranwendung belegt · Baureihe im Beleg prüfen':'Herstelleranwendung belegt · Bedingungen prüfen')+'</span>'+
   '<h3>'+esc(p.part_name)+'</h3><p class="catalog-item-maker">'+esc(p.manufacturer)+
   ' · Art.-Nr. '+esc(p.manufacturer_part_number)+'</p>'+
   '<p class="catalog-item-engine">Ausführung: '+esc(p.engine)+'</p>'+
   (p.oe?.length?'<p class="catalog-item-engine">OE-Referenzen: '+esc(p.oe.join(", "))+'</p>':"")+
   '<p class="catalog-item-warning">'+esc(p.fitment?.notes||"Vor Kauf am Fahrzeug überprüfen.")+'</p>'+
   priceMarkup+'<div class="catalog-item-actions">'+source+shop+'</div></div></article>';
 }).join("");
 $("resultsGrid").innerHTML=intro+'<div class="catalog-item-grid">'+cards+'</div>';
 setCatalogStatus("ready");
}
function renderOpenOilReferences(rows,term){
 if(!state.vehicle)return;
 const sourceUrl="https://github.com/carbonautorepair/oilspec-commons";
 const cacheInfo=window.CarPartsOpenOil?.lastInfo||{};
 const cacheLabel=cacheInfo.source==="newly-saved"
  ? "Neu recherchiert und in Supabase gespeichert ("+Number(cacheInfo.stored||0)+" Datensätze)"
  : cacheInfo.source==="database" ? "Bereits aus Supabase geladen – ohne neue externe Abfrage"
  : cacheInfo.source==="database-stale" ? "Vorhandene Referenzen aus Supabase"
  : "Lokale CC0-Quelle – Datenbankverbindung nicht verfügbar";
 const grid=$("resultsGrid");
 $("resultsTitle").textContent="Ölfilter-Recherche · "+vehicleLabel(state.vehicle);
 grid.innerHTML='<div class="open-oil-summary">'+
  '<span class="open-oil-label">Öffentliche CC0-Datenbank · Community-Daten, NICHT verifiziert</span>'+
  '<h3>Ölfilter-Referenzen aus OilSpec Commons</h3>'+
  '<p class="open-oil-cache-source">'+esc(cacheLabel)+'</p>'+
  '<p>Für das gewählte Modell und Jahr wurden '+rows.length+
  ' Datensätze gefunden. Das sind <strong>keine bestätigten passenden Ersatzteile</strong>.'+
  ' Die Daten stammen zum Teil von Fahrzeugen anderer Märkte und können Fehler enthalten.'+
  ' Wähle den <strong>genauen Motor aus dem Quelldatensatz</strong> und vergleiche dessen Angaben'+
  ' mit deinem Fahrzeug und dem Filterhersteller. Kauf nicht allein anhand dieser Liste.</p>'+
  '<label class="open-oil-picker-label" for="openOilEngine">Motor aus der Open-Data-Quelle abgleichen</label>'+
  '<select id="openOilEngine"><option value="">Bitte genaue Quellvariante wählen</option>'+
  rows.map((r,i)=>'<option value="'+i+'">'+esc(r[3])+' · '+esc(r[4])+
  (rows.some((other,j)=>j!==i&&other[3]===r[3]&&other[4]===r[4])?' · Datensatz '+(i+1):'')+
  '</option>').join("")+'</select>'+
  '<p class="open-oil-source">Quelle: <a target="_blank" rel="noopener noreferrer" href="'+sourceUrl+
  '">OilSpec Commons (CC0 1.0) ↗</a> · Nicht aus einem Herstellerkatalog überprüft.</p></div>'+
  '<div id="openOilCards" class="open-oil-products"><div class="open-oil-select-prompt">'+
  'Wähle oben zuerst die genaue Quellvariante. Ein Modellname allein reicht für eine Filterempfehlung nicht aus.'+
  '</div></div>';
 setCatalogStatus("community");
 const selector=$("openOilEngine"),cards=$("openOilCards");
 selector.onchange=()=>{
  const idx=Number(selector.value);
  if(selector.value===""||!Number.isInteger(idx)||!rows[idx]){
   cards.innerHTML='<div class="open-oil-select-prompt">Zuerst eine Quellvariante auswählen.</div>';return;
  }
  const line=rows[idx],brands=window.CarPartsOpenOil?.brands||window.CARPARTS_OPEN_OILFILTERS?.brands||[];
  const unique=new Map();
  (line[5]||[]).forEach(pair=>{
   const brand=brands[pair[0]],sku=pair[1];
   if(typeof brand==="string"&&typeof sku==="string"&&!unique.has(brand+"|"+sku))
     unique.set(brand+"|"+sku,{brand,sku});
  });
  cards.innerHTML=[...unique.values()].slice(0,10).map(p=>
   '<article class="catalog-item open-oil-card">'+
   '<div class="catalog-item-visual">'+placeholderPartImage("Ölfilter")+
   '<span>Symbolillustration · kein Produktfoto</span></div>'+
   '<div class="catalog-item-body">'+
   '<span class="open-oil-warning">⚠ Ungeprüfte Teilenummer aus Community-Daten</span>'+
   '<h3>Ölfilter · '+esc(p.brand)+'</h3>'+
   '<p class="catalog-item-maker">Referenz: <strong>'+esc(p.sku)+'</strong></p>'+
   '<p class="catalog-item-engine">Quelldatensatz: '+esc(line[3])+' · '+esc(line[4])+
   ' · Baujahr '+esc(line[2])+'</p>'+
   '<p class="catalog-item-warning">Keine bestätigte Passform. Motorcode, Markt, Filtergehäuse'+
   ' und genaue Teilenummer unbedingt beim Hersteller prüfen.</p>'+
   '<div class="catalog-item-price unavailable"><strong>Preis nicht verfügbar</strong>'+
   '<span>Keine geprüfte Händlerquelle oder Produktfotolizenz</span></div>'+
   '<div class="catalog-item-actions"><a href="'+sourceUrl+
   '" target="_blank" rel="noopener noreferrer">Offene Datenquelle ansehen ↗</a></div>'+
   '</div></article>'
  ).join("")||'<div class="open-oil-select-prompt">Keine auswertbare Filterreferenz für diese Variante.</div>';
 };
}
function showWebReferences(panel,results){
 const hits=results.filter(item=>/^https:\/\//i.test(item.url));
 if(!hits.length)return;
 panel.insertAdjacentHTML("beforeend",'<section class="web-merchant-section"><header><h3>Weitere Händlerquellen</h3>'+
  '<p>Quelle: <a href="https://developer.mwmbl.org/terms/" target="_blank" rel="noopener noreferrer">Mwmbl · CC BY-NC-SA 4.0</a></p></header>'+
  '<div class="web-merchant-grid">'+hits.map(item=>'<article class="web-merchant-card"><h4>'+
   esc(item.title)+'</h4><p>'+esc(item.snippet||"")+'</p><a href="'+esc(item.url)+
   '" target="_blank" rel="noopener noreferrer">Händlerseite ansehen</a></article>').join("")+'</div></section>');
}
function renderOpenDiagnostic(rows,term){
 const title=rows[0]?.code_name||"Fehlercode aus der freien Datensammlung";
 const make=state.vehicle?.make||"das Fahrzeug";
 const unique=new Map();
 rows.forEach(r=>{
  if(r.part_name&&!unique.has(r.part_name))unique.set(r.part_name,r);
 });
 const matched=[...unique.values()].slice(0,18);
 $("resultsTitle").textContent="Diagnose-Recherche · Fehlercode "+esc(String(term).toUpperCase());
 $("resultsGrid").innerHTML=
  '<section class="diagnostic-overview">'+
  '<span class="diagnostic-label">Open-Data-Bauteilhinweise · ODbL 1.0 · KEINE Ersatzteil-Freigabe</span>'+
  '<h3>Fehlercode '+esc(String(term).toUpperCase())+' · '+esc(title)+'</h3>'+
  '<p>Die folgenden Bezeichnungen stammen aus einer frei lizenzierten Diagnose-Datensammlung.'+
  ' Sie sind <strong>mögliche, von einem Fehlercode betroffene Bauteilarten</strong>, keine spezifischen'+
  ' Produktnummern und keine Diagnose für '+esc(make)+'. Ein Fehlercode allein beweist nicht,'+
  ' dass ein Bauteil defekt ist. Vor Arbeiten die genaue Diagnose fachgerecht klären.</p>'+
  '<p>Quelle: <a href="https://github.com/MechanicDB/MechanicDB-public" target="_blank" rel="noopener noreferrer">'+
  'MechanicDB Free Developer Sample (ODbL 1.0) ↗</a> ·'+
  ' <a href="https://github.com/zzfizez-ux/CarParts/blob/main/data/open-diagnostic-part-hints.json"'+
  ' target="_blank" rel="noopener noreferrer">Abgeleitete offene Daten ansehen ↗</a></p></section>'+
  '<div class="diagnostic-hint-list">'+matched.map(p=>
   '<article class="diagnostic-hint"><span class="diagnostic-label">Recherchehinweis · nicht fitmentgeprüft</span>'+
   '<h4>'+esc(p.part_name)+'</h4>'+
   '<p>Keine passende Teilenummer, kein Preis und keine bestätigte Fahrzeugkompatibilität vorhanden.</p>'+
   '</article>').join("")+'</div>';
 setCatalogStatus("diagnostic");
}
function seriesMatches(vehicle,text){
 return seriesEvidence(vehicle,text,availableSeries())!=="conflict";
}

function showProductOffers(panel,items){
 if(!items.length)return;
 const grid=document.createElement("div");
 grid.className="catalog-item-grid";
 for(const item of items){
  const price=new Intl.NumberFormat("de-DE",{style:"currency",currency:item.currency}).format(item.price);
  const card=document.createElement("article");
  card.className="catalog-item";
  const productSource=/^https:\/\//i.test(item.source_url)
   ?'<a class="catalog-evidence" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Herstelleranwendung</a>':"";
  card.innerHTML='<div class="catalog-item-visual"><img loading="lazy" referrerpolicy="no-referrer" src="'+esc(item.image)+'" alt="'+esc(item.name)+'"></div>'+
   '<div class="catalog-item-body"><p class="catalog-item-maker">'+esc(item.merchant)+'</p><h3>'+esc(item.name)+'</h3>'+
   (item.sku?'<p>Art.-Nr. '+esc(item.sku)+'</p>':'')+'<p>'+esc(item.condition)+'</p>'+
   '<div class="catalog-item-price"><strong>'+esc(price)+'</strong><span>Händlerpreis · Versand siehe Angebot · Stand '+
   esc(new Date(item.observed_at).toLocaleString("de-DE"))+'</span></div><div class="catalog-item-actions">'+productSource+
   '<a class="catalog-buy" href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Zum Produkt bei '+esc(item.merchant)+'</a></div></div>';
  const image=card.querySelector("img");
  image.addEventListener("error",()=>{
   const fallback=document.createElement("p");
   fallback.textContent="Produktbild derzeit nicht abrufbar";
   image.replaceWith(fallback);
  },{once:true});
  grid.append(card);
 }
 panel.append(grid);
}

function showManufacturerReferences(panel,rows){
 if(!rows.length)return;
 const container=document.createElement("section");
 container.innerHTML='<div class="catalog-grid-heading"><h3>Herstellerreferenzen</h3>'+
  '<p>Motor, Baureihe und Ausstattungsbedingungen mit der Herstelleranwendung abgleichen.</p></div>';
 for(const row of rows){
  const card=document.createElement("article");
  card.className="source-research-card catalog-item-body";
  const name=document.createElement("strong");
  name.textContent=[row.manufacturer,row.part_name,row.manufacturer_part_number].filter(Boolean).join(" · ");
  const detail=document.createElement("p");
  detail.textContent=[row.source_vehicle_variant,row.fitment_conditions].filter(Boolean).join(" · ");
  card.append(name,detail);
  if(/^https:\/\//i.test(row.source_url)){
   const link=document.createElement("a");
   link.href=row.source_url;link.target="_blank";link.rel="noopener noreferrer";
   link.textContent="Herstellerquelle öffnen";card.append(link);
  }
  container.append(card);
 }
 panel.append(container);
}

function showRapidReferences(panel,parts){
 if(!parts.length)return;
 const section=document.createElement("section");
 section.innerHTML='<div class="catalog-grid-heading"><h3>Teilehinweise von Auto Parts Finder</h3>'+
  '<p>Die Quelle sucht nach Modell, Baujahr und Motor. Baureihe, Teilenummer und Ausstattung beim Hersteller abgleichen.</p></div>';
 for(const part of parts){
  const card=document.createElement("article");
  card.className="source-research-card catalog-item-body";
  const title=document.createElement("strong");
  title.textContent=part.reference;
  const description=document.createElement("p");
  description.textContent=part.type;
  card.append(title,description);
  if(/^https:\/\//i.test(part.image)){
   const photo=document.createElement("img");
   photo.src=part.image;
   photo.alt=part.reference;
   photo.width=120;
   photo.loading="lazy";
   photo.referrerPolicy="no-referrer";
   photo.addEventListener("error",()=>photo.remove(),{once:true});
   card.append(photo);
  }
  const price=document.createElement("p");
  if(Number.isFinite(part.price)&&part.price>0){
   price.textContent="Preis laut Anbieter · "+(part.currency
    ?new Intl.NumberFormat("de-DE",{style:"currency",currency:part.currency}).format(part.price)
    :new Intl.NumberFormat("de-DE",{minimumFractionDigits:2}).format(part.price)+" (Währung offen)");
  }else price.textContent="Preis beim Händler prüfen";
  card.append(price);
  if(/^https:\/\//i.test(part.url)){
   const link=document.createElement("a");
   link.href=part.url;
   link.target="_blank";
   link.rel="noopener noreferrer";
   link.textContent="Händlerquelle öffnen ↗";
   card.append(link);
  }
  section.append(card);
 }
 panel.append(section);
}

function merchantNotice(data){
 if(data.status==="busy")return "Für dieses Fahrzeug und Teil läuft bereits eine Suche. Bitte versuche es in Kürze erneut.";
 if(data.merchant_status==="quota")return "Das Tageslimit für Händlerabfragen ist erreicht.";
 if(data.merchant_status==="cooldown")return "Neue Händlerabfragen für dieses Teil sind in wenigen Minuten verfügbar.";
 if(data.merchant_failures?.length)return "Einige Händlerdaten waren gerade nicht abrufbar.";
 if(!data.products?.length&&["access","unavailable"].includes(data.rapid_status))return "Auto Parts Finder ist vorübergehend nicht verfügbar.";
 if(!data.products?.length&&data.rapid_status==="quota")return "Das Abfragelimit von Auto Parts Finder ist erreicht.";
 if(data.web_status==="quota"&&!data.products?.length)return "Das Tageslimit der Websuche ist erreicht.";
 if(data.web_status==="provider_error"&&!data.products?.length)return "Die ergänzende Websuche ist gerade nicht erreichbar.";
 return "";
}

async function showSharedResearch(vehicle,term,requestId){
 const panel=$("sharedResearch");
 panel.textContent="Händlerangebote und Teilequellen werden gesucht…";
 try{
  const data=await window.CarPartsDB.searchLiveWeb(vehicle,term);
  if(requestId!==catalogRequest)return {};
  const products=(data.products||[]).filter(item=>Number.isFinite(item.price)&&item.price>0&&item.currency==="EUR"&&
   /^https:\/\//i.test(item.image)&&/^https:\/\//i.test(item.url)&&seriesMatches(vehicle,item.name));
  const references=(data.references||[]).filter(row=>seriesMatches(vehicle,row.source_vehicle_variant));
  const links=(data.results||[]).filter(item=>/^https:\/\//i.test(item.url)&&seriesMatches(vehicle,[item.title,item.snippet].join(" ")));
  const rapid=(data.rapid_parts||[]).filter(item=>seriesMatches(vehicle,[item.reference,item.type].join(" ")));
  panel.replaceChildren();
  if(products.length){
   const header=document.createElement("div");
   header.className="catalog-grid-heading";
   header.innerHTML="<h3>Händlerangebote ("+products.length+")</h3>";
   panel.append(header);
   showProductOffers(panel,products);
  }
  const offered=new Set(products.map(item=>item.sku).filter(Boolean));
  showManufacturerReferences(panel,references.filter(row=>!offered.has(row.manufacturer_part_number)));
  showRapidReferences(panel,rapid);
  showWebReferences(panel,links);
  const notice=merchantNotice(data);
  if(notice || (products.length&&data.status==="cached")){
   const message=document.createElement("p");
   message.className="web-merchant-note";
   message.textContent=notice || "Angebote aus der letzten Händlerabfrage.";
   panel.append(message);
  }
  return {hasProducts:products.length>0,hasReferences:references.length>0||links.length>0||rapid.length>0,busy:data.status==="busy"};
 }catch{
  if(requestId===catalogRequest)panel.textContent="Händlerrecherche gerade nicht erreichbar.";
  return {};
 }
}

async function renderSupabaseResults(term,requestId){
 setCatalogStatus("loading");
 const grid=$("resultsGrid");
 const panel=$("sharedResearch");
 panel.replaceChildren();
 grid.innerHTML='<div class="empty-results">Prüfe Herstellerdaten…</div>';
 const current={...state.vehicle};
 const db=window.CarPartsDB;
 if(db.diagnosticCode(term)){
  try {
   const hints=await db.findDiagnosticParts(term,current.make);
   if(requestId!==catalogRequest)return false;
   if(hints?.length){renderOpenDiagnostic(hints,term);return true;}
   inlineCatalogEmpty(term);
  }catch{
   if(requestId===catalogRequest)inlineCatalogEmpty(term,true);
  }
  return false;
 }
 const shared=showSharedResearch(current,term,requestId);
 let shown=false,unavailable=false;
 try{
  const rows=await db.findVerifiedParts(current,term);
  if(requestId!==catalogRequest)return false;
  if(rows.length){renderSupabaseCards(rows,term);shown=true;}
 }catch{unavailable=true;}
 const sources=await shared;
 if(requestId!==catalogRequest)return false;
 if(sources.hasProducts||sources.hasReferences){
  if(!shown){
   grid.replaceChildren();
   $("resultsTitle").textContent="Teile für "+vehicleLabel(current)+" · "+current.year;
   setCatalogStatus(sources.hasProducts?"merchant":"research");
  }
  return true;
 }
 if(shown)return true;
 if(window.CarPartsOpenOil?.isOilFilterQuery(term)){
  try{
   const refs=await window.CarPartsOpenOil.find(current,term);
   if(requestId!==catalogRequest)return false;
   if(refs?.length){renderOpenOilReferences(refs,term);return true;}
  }catch{/* A source may be out of service while the rest of the search works. */}
 }
 inlineCatalogEmpty(term,unavailable);
 if(db.researchCategory(term) && !sources.busy){
  try{
   const candidates=await db.researchParts(current,term);
   if(requestId!==catalogRequest)return false;
   const rows=(candidates?.rows||[]).filter(row=>seriesMatches(current,row.source_vehicle_variant));
   if(rows.length){
    grid.replaceChildren();
    showManufacturerReferences(panel,rows);
    setCatalogStatus("research");
   }else if(candidates?.search_saved){
    const notice=document.createElement("p");
    notice.className="web-merchant-note";
    notice.textContent="Teileanfrage für den Katalog vorgemerkt.";
    panel.append(notice);
   }
  }catch{/* The current manual search still works for vehicles outside the parts catalog. */}
 }
 return true;
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
 $("resultsTitle").textContent="Real catalog results for "+vehicleLabel(state.vehicle);
 if(!rows.length){$("resultsGrid").innerHTML='<div class="empty-results">No matching catalog records found. Try an OE number, article number or more exact vehicle details.</div>';return true}
 $("resultsGrid").innerHTML=rows.map((p,i)=>{
 const fit=p.fitment||{},confirmed=!state.vehicle.series&&(fit.status==="confirmed"||fit.status==="exact");
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
async function search(){
 const q=$("partSearch").value.trim();
 if(q.length>80){show("Bitte kürze den Suchbegriff auf höchstens 80 Zeichen.");return;}
 if(!state.vehicle){show("Bitte zuerst Marke, Modell, Baureihe und Baujahr wählen.");$("finder").scrollIntoView({behavior:"smooth"});return}
 if(!q){show("Bitte Teilebezeichnung oder Artikelnummer eingeben.");return}
 const typed=window.CarPartsVIN.check($("vin").value);
 if(typed.vin&&["invalid","mismatch","checking"].includes(vinResult.status)){
  show("VIN-Prüfung enthält einen Fehler. Bitte die VIN/Fahrzeugauswahl korrigieren.");
  $("vinStatus").scrollIntoView({behavior:"smooth",block:"center"});return;
 }
 $("parts").scrollIntoView({behavior:"smooth"});
 const searchedVehicle=state.vehicle;
 const searchId=catalogRequest+1;
 await renderLiveResults(q);
 if(searchId!==catalogRequest||searchedVehicle!==state.vehicle)return;
 if(searchedVehicle?.series&&!window.CarPartsDB?.diagnosticCode(q)&&!$("sharedResearch")?.querySelector(".catalog-item-grid")){
  const v=searchedVehicle, phrase=[v.make,v.model,v.series,v.year,v.engine,v.variant,q].filter(Boolean).join(" ");
  const box=document.createElement("aside");box.className="web-merchant-note";
  const link=document.createElement("a");link.href="https://www.google.com/search?q="+encodeURIComponent(phrase);
  link.target="_blank";link.rel="noopener noreferrer";link.textContent=phrase+" ↗";
  box.append("Gezielt nach dieser Ausführung suchen: ",link);
  $("resultsGrid").prepend(box);
 }
 if(typed.vin&&state.vehicle){
  const panel=$("resultsGrid");
  const confirmed=vinResult.status==="matched";
  const message=confirmed?
   "VIN-Stammdaten abgeglichen – die angezeigten Teile sind NICHT individuell per VIN auf Passform bestätigt. Motorcode, Bauzeit und Ausstattung prüfen.":
   "Teilesuche anhand der Fahrzeugauswahl. Für einen VIN-Abgleich klicke bei den Fahrzeugangaben auf „VIN jetzt prüfen“.";
  panel.insertAdjacentHTML("afterbegin",'<div class="vin-results-disclaimer">'+esc(message)+'</div>');
 }
 $("parts").scrollIntoView({behavior:"smooth"});
}
function clearEngine(){ $("engine").value=""; $("engineCustom").value=""; }
function modelChanged(){
 clearEngine(); $("variant").value="";
 if(hasSeries)loadSeries();
 loadEngines();vehicleChanged();
}
$("make").onchange=()=>{ $("model").value="";loadModels();modelChanged(); };
$("model").onchange=modelChanged;
$("year").onchange=()=>{clearEngine();loadEngines();vehicleChanged();};
if(hasSeries){
 $("series").addEventListener("seriesloaded",()=>{
  loadEngines();
  vehicleChanged();
 });
 $("series").onchange=()=>{
  const year=$("year").value;
  $("customSeries").hidden=$("series").value!=="__other";$("customSeries").value="";
  updateSeriesYears(year);clearEngine();loadEngines();vehicleChanged();
 };
 $("customSeries").oninput=vehicleChanged;
}
$("engine").onchange=()=>{$("engineCustom").value="";vehicleChanged()};$("engineCustom").oninput=vehicleChanged;$("variant").oninput=vehicleChanged;
function markVinUnchecked(){
 vinCheckSequence++;vinResult={status:"unchecked",vin:window.CarPartsVIN.check($("vin").value).vin,decoded:null,local:null,reason:""};
 vehicleChanged();
}
$("vin").addEventListener("input",markVinUnchecked);
$("searchBtn").onclick=search;$("partSearch").addEventListener("keydown",e=>{if(e.key==="Enter")search()});document.querySelectorAll(".quick-tags button").forEach(b=>b.onclick=()=>{$("partSearch").value=b.dataset.part;search()});
document.querySelectorAll(".quality-toggle button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".quality-toggle button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.mode=b.dataset.mode;const q=$("partSearch").value.trim();if(q&&state.vehicle)renderLiveResults(q);else renderResults()});
$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");storePreference("cp-dark",document.body.classList.contains("dark"));$("themeBtn").firstChild.textContent=document.body.classList.contains("dark")?"☀ ":"☾ ";$("themeBtn").lastChild.textContent=state.lang==="de"?(document.body.classList.contains("dark")?"Hell":"Dunkel"):(document.body.classList.contains("dark")?"Light":"Dark")};
if(preference("cp-dark")==="true"){document.body.classList.add("dark");$("themeBtn").firstChild.textContent="☀ "}

const T={en:{series:"Generation / chassis code",how:"How it works",browse:"Browse parts",why:"Why CarParts",dark:"Dark",garage:"My garage",saveGarage:"Save vehicle",smart:"Smart vehicle parts search",heroTitle:"Find the right part.<br><em>First time.</em>",heroText:"Select your vehicle and search source-backed replacement parts directly on CarParts. Availability, photos and prices appear only when verified data is available.",findPart:"Find a part <span>→</span>",seeHow:"See how it works",compat:"compatibility focused",after:"and aftermarket",data:"vehicle data assisted",yourVehicle:"YOUR VEHICLE",ready:"READY",change:"Change",exactFit:"Vehicle check",finder:"PART FINDER",startKnow:"Start with what you know.",finderText:"Search the live vehicle database by make, model, year and engine. You can also choose a vehicle photo for local VIN recognition.",uploadTitle:"Upload a vehicle photo",uploadText:"Choose a photo with a readable VIN, such as a picture of your registration document.",choose:"Choose file",vehicleDetails:"VEHICLE DETAILS",make:"Brand",model:"Model",year:"Year",engine:"Engine",body:"Body / variant",need:"What do you need?",search:"Search",partPlaceholder:"e.g. front brake pads, oil filter…",matched:"PARTS ON CARPARTS",best:"Best value",premium:"Premium",oem:"OEM",noGuess:"NO GUESSING",confidenceTitle:"Not enough information? We'll tell you exactly what to check.",confidenceText:"If more than one variant is possible, CarParts will not pretend the fit is certain. We'll explain what is missing — such as VIN, engine code, OEM number, dimensions or a clearer photo.",example:"See an example →",howIt:"HOW IT WORKS",howTitle:"Parts shopping, without the parts knowledge.",howText:"Select your vehicle, then see available source-backed parts directly on CarParts. Exact fitment requires checking the manufacturer details.",step1:"Identify your vehicle",step1p:"Use the live vehicle database, a VIN, or choose a photo to read the VIN.",step2:"Tell us what you need",step2p:"Search by part name. CarParts keeps the selected vehicle attached to the search.",step3:"Choose your match",step3p:"See sourced articles and current merchant offers when available, with missing prices clearly indicated.",built:"BUILT DIFFERENT",builtTitle:"The simple way to find vehicle parts.",f1:"Vehicle-first search",f1p:"Vehicle selection comes before part matching, reducing generic and incorrect results.",f2:"Clear compatibility",f2p:"No fake certainty. Missing fitment information is called out and explained.",f3:"Your preference, your price",f3p:"Find the cheapest good option, best value, premium quality or original parts."},de:{series:"Baureihe / Typcode",how:"So funktioniert's",browse:"Teile finden",why:"Warum CarParts",dark:"Dunkel",garage:"Meine Garage",saveGarage:"Fahrzeug speichern",smart:"Intelligente Teilesuche",heroTitle:"Das richtige Teil.<br><em>Beim ersten Mal.</em>",heroText:"Gib dein Fahrzeug und das gesuchte Teil an. CarParts sucht passende Teile — von Ersatzteilen bis zu Original-OEM-Teilen.",findPart:"Teil finden <span>→</span>",seeHow:"So funktioniert's",compat:"auf Kompatibilität fokussiert",after:"OEM & Zubehör",data:"mit Fahrzeugdaten",yourVehicle:"DEIN FAHRZEUG",ready:"BEREIT",change:"Ändern",exactFit:"Fahrzeugabgleich",finder:"TEILEFINDER",startKnow:"Starte mit deinen Angaben.",finderText:"Suche über die Fahrzeugdatenbank nach Marke, Modell, Baujahr und Motor. Du kannst die VIN auch aus einem Fahrzeugfoto erkennen lassen.",uploadTitle:"Fahrzeugfoto hochladen",uploadText:"Wähle ein Foto mit lesbarer VIN, etwa ein Bild vom Fahrzeugschein.",choose:"Datei wählen",vehicleDetails:"FAHRZEUGDATEN",make:"Marke",model:"Modell",year:"Baujahr",engine:"Motor",body:"Karosserie / Variante",need:"Was brauchst du?",search:"Suchen",partPlaceholder:"z. B. Bremsbeläge vorne, Ölfilter…",matched:"ERSATZTEILE AUF CARPARTS",best:"Preis-Leistung",premium:"Premium",oem:"OEM",noGuess:"KEIN RATESPIEL",confidenceTitle:"Nicht genug Informationen? Wir sagen dir genau, was noch fehlt.",confidenceText:"Wenn mehrere Varianten möglich sind, behauptet CarParts nicht einfach, dass das Teil passt. Wir zeigen dir, ob VIN, Motorkennbuchstabe, OEM-Nummer, Maße oder ein klareres Foto fehlt.",example:"Beispiel ansehen →",howIt:"SO FUNKTIONIERT'S",howTitle:"Teilesuche ohne Fachwissen.",howText:"Wähle dein Fahrzeug und sieh dir belegte Ersatzteile direkt auf CarParts an. Prüfe vor dem Kauf die genaue Herstellerausführung.",step1:"Fahrzeug bestimmen",step1p:"Nutze die Live-Fahrzeugdatenbank, eine VIN oder wähle ein Foto, um die VIN zu erkennen.",step2:"Teil angeben",step2p:"Suche nach dem Namen des Teils. Dein Fahrzeug bleibt mit der Suche verknüpft.",step3:"Passendes Teil wählen",step3p:"Vergleiche Preis-Leistung, Premium und OEM — mit klarer Kennzeichnung bei Unsicherheit.",built:"ANDERS GEDACHT",builtTitle:"Die einfache Art, Fahrzeugteile zu finden.",f1:"Fahrzeug zuerst",f1p:"Die Fahrzeugauswahl kommt vor der Teilesuche und reduziert allgemeine Fehlresultate.",f2:"Klare Kompatibilität",f2p:"Keine erfundene Sicherheit. Fehlende Angaben werden erklärt.",f3:"Deine Wahl, dein Preis",f3p:"Günstig und gut, beste Preis-Leistung, Premium oder Originalteil."}};
function applyLang(){const d=T[state.lang];document.documentElement.lang=state.lang;document.querySelectorAll("[data-i18n]").forEach(el=>{const k=el.dataset.i18n;if(d[k]!=null)el.innerHTML=d[k]});document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>el.placeholder=d[el.dataset.i18nPlaceholder]);$("langBtn").textContent=state.lang==="en"?"DE":"EN";$("themeBtn").lastChild.textContent=state.lang==="de"?(document.body.classList.contains("dark")?"Hell":"Dunkel"):(document.body.classList.contains("dark")?"Light":"Dark");storePreference("cp-lang",state.lang)}
$("langBtn").onclick=()=>{state.lang=state.lang==="en"?"de":"en";applyLang()};applyLang();

$("uploadBtn").onclick=()=>$("photoInput").click();document.querySelector(".upload-card").onclick=e=>{if(e.target.closest("button"))return;$("photoInput").click()};
let scanSequence=0;
let photoUrl="";
$("photoInput").onchange=async()=>{
 const file=$("photoInput").files[0];
 if(!file)return;
 const scan=++scanSequence;
 if(!file.type.startsWith("image/")||file.type==="image/svg+xml"){
  $("scanProgress").textContent="Wähle ein Bild mit lesbarer VIN.";
  return;
 }
 if(file.size>12*1024*1024){
  $("scanProgress").textContent="Wähle ein Foto mit höchstens 12 MB.";
  return;
 }
 if(photoUrl)URL.revokeObjectURL(photoUrl);
 photoUrl=URL.createObjectURL(file);
 const photo=document.createElement("img");
 photo.src=photoUrl;photo.alt="Fahrzeugfoto";
 $("preview").replaceChildren(photo);
 $("preview").style.display="block";
 $("scanProgress").textContent="Suche nach einer lesbaren VIN…";
 try{
  if(!window.Tesseract)throw Error("OCR unavailable");
  const result=await window.Tesseract.recognize(file,"eng",{
   workerPath:"https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
   corePath:"https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/",
   langPath:"https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int"
  });
  if(scan!==scanSequence)return;
  const vin=(result.data.text.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/)||[])[0];
  if(!vin){
   $("scanProgress").textContent="Keine lesbare VIN gefunden. Gib sie ein oder wähle das Fahrzeug manuell.";
   return;
  }
  $("vin").value=vin;
  markVinUnchecked();
  $("scanProgress").textContent="VIN aus dem Foto übernommen. Klicke auf „VIN jetzt prüfen“, wenn du die Fahrzeugdaten abgleichen möchtest.";
 }catch{
  if(scan===scanSequence)$("scanProgress").textContent="Das Bild konnte nicht gelesen werden. Wähle das Fahrzeug manuell.";
 }
};
async function decodeVin(input){
 const local=window.CarPartsVIN.check(input);
 const token=++vinCheckSequence;
 $("vin").value=local.vin;
 if(!local.valid){
  vinResult={status:local.vin?"invalid":"idle",vin:local.vin,decoded:null,local,reason:local.reason};
  updateVinUI();vehicleChanged();return false;
 }
 vinResult={status:"checking",vin:local.vin,decoded:null,local,reason:""};
 updateVinUI();
 try{
  // This call sends the VIN ONLY to NHTSA's public API; it is never saved in Supabase or the garage.
  const d=await api("/DecodeVinValuesExtended/"+encodeURIComponent(local.vin)+"?format=json");
  if(token!==vinCheckSequence||window.CarPartsVIN.check($("vin").value).vin!==local.vin)return false;
  const row=Array.isArray(d.Results)?d.Results[0]:null;
  if(!row||typeof row!=="object")throw Error("No VIN decoder results");
  const p=window.CarPartsVIN.profile(row);
  vinResult={status:"partial",vin:local.vin,decoded:p,local,reason:""};
  // Never overwrite a manually selected car without explicit permission.
  if(p.make&&p.model&&p.year&&(!$("make").value||!$("model").value||!$("year").value)){
   await applyVinVehicleProfile(p,false);
  }
  if(token!==vinCheckSequence)return false;
  refreshVinComparison();
  $("scanProgress").textContent=vinResult.status==="matched"?
   "VIN-Stammdaten abgeglichen. Ersatzteile zusätzlich anhand Motor-/PR-Code prüfen.":
   "VIN nicht vollständig bestätigt. Marke, Modell, Baureihe und Baujahr mit Fahrzeugunterlagen abgleichen.";
  return vinResult.status==="matched";
 }catch(e){
  if(token!==vinCheckSequence)return false;
  vinResult={status:"unavailable",vin:local.vin,decoded:null,local,reason:""};
  $("scanProgress").textContent="VIN-Abfrage nicht möglich. Die Fahrzeugauswahl bleibt manuell nutzbar.";
  updateVinUI();
  return false;
 }
}
$("vinCheckBtn").onclick=()=>decodeVin($("vin").value);
$("vinApplyBtn").onclick=async()=>{
 if(!vinResult.decoded)return;
 await applyVinVehicleProfile(vinResult.decoded,true);
 refreshVinComparison();
 if(vinResult.status==="mismatch")show("Nicht alle VIN-Fahrzeugdaten sind in unserer Modellauswahl verfügbar.");
};


$("learnBtn").onclick=()=>show("Die VIN hilft beim Fahrzeugabgleich, bestätigt aber keine 100%ige Teilepassung. Motorcode, PR-Codes, OE-Nummer und Herstellervorgaben zusätzlich vergleichen.");
$("changeVehicle").onclick=()=>$("finder").scrollIntoView({behavior:"smooth"});function openModal(content){$("modalContent").innerHTML=content;$("modalBackdrop").classList.add("open")}function closeModal(){$("modalBackdrop").classList.remove("open")}$("modalClose").onclick=closeModal;$("modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")closeModal()};
function saveGarage(){
 if(!state.vehicle)return;
 const vehicle={...state.vehicle};
 // Only vehicle selections are stored locally. A VIN never belongs in the garage.
 const alreadySaved=state.garage.some(saved=>
  ["make","model","series","year","engine","variant"].every(key=>String(saved[key])===String(vehicle[key])));
 if(alreadySaved){
  show(state.lang==="de"?"Fahrzeug bereits gespeichert.":"Vehicle already saved.");
  return;
 }
 const updated=[...state.garage,vehicle];
 if(!storePreference("cp-garage",JSON.stringify(updated))){
  show(state.lang==="de"?"Die Garage konnte im Browser nicht gespeichert werden.":"The browser could not save the garage.");
  return;
 }
 state.garage=updated;
 updateGarageCount();
 show(state.lang==="de"?"Fahrzeug zur Garage hinzugefügt.":"Vehicle added to your garage.");
}

function updateGarageCount(){
 const count=$("garageCount");
 count.textContent=state.garage.length;
 count.hidden=!state.garage.length;
}

async function restoreGarage(vehicle){
 $("vin").value="";
 vinCheckSequence++;
 vinResult={status:"idle",vin:"",decoded:null,local:null,reason:""};
 $("make").value=vehicle.make;
 await loadModels();
 if($("make").value!==vehicle.make)return;
 $("model").value=vehicle.model;
 if(!$("model").value){
  closeModal();
  show(state.lang==="de"?"Dieses gespeicherte Modell ist gerade nicht verfügbar.":"This saved model is currently unavailable.");
  return;
 }
 await loadSeries(vehicle.series||"",String(vehicle.year));
 if($("make").value!==vehicle.make||$("model").value!==vehicle.model)return;
 $("variant").value=vehicle.variant||"";
 clearEngine();
 loadEngines(vehicle.engine||"");
 vehicleChanged();
 closeModal();
 $("finder").scrollIntoView({behavior:"smooth"});
}

function openGarage(){
 const title=state.lang==="de"?"Meine Garage":"My garage";
 const empty=state.lang==="de"?"Wähle ein Fahrzeug im Teilefinder und speichere es in der Garage.":"Choose a vehicle in the parts finder and save it to your garage.";
 const select=state.lang==="de"?"Auswählen":"Select";
 let content="<h2>"+title+"</h2>";
 content+=state.garage.length?'<div class="garage-list">'+state.garage.map((vehicle,index)=>
  '<div class="garage-item"><div><strong>'+esc(vehicleLabel(vehicle))+'</strong><br><small>'+
  esc(vehicle.year)+(vehicle.engine?" · "+esc(vehicle.engine):"")+'</small></div><button data-garage="'+index+'">'+
  select+'</button></div>').join("")+'</div>':"<p>"+empty+"</p>";
 openModal(content);
 document.querySelectorAll("[data-garage]").forEach(button=>{
  button.onclick=()=>restoreGarage(state.garage[Number(button.dataset.garage)]);
 });
}
$("garageBtn").onclick=openGarage;
$("saveGarageBtn").onclick=saveGarage;
updateGarageCount();
years();loadMakes();loadEngines();updateVinUI();renderResults();
