// VIN verification helpers for CarParts.
// The ISO/US checksum checks transcription; it does NOT authenticate vehicle ownership or prove parts fitment.
// For some international VINs (including European-market vehicles) position 9 is not required to use the North-American check-digit convention.
(function(){
"use strict";
const weights=[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
const translit="A1B2C3D4E5F6G7H8J1K2L3M4N5P7R9S2T3U4V5W6X7Y8Z9";
const letterValues={};
for(let i=0;i<translit.length;i+=2)letterValues[translit[i]]=Number(translit[i+1]);
function clean(v){return String(v||"").toUpperCase().replace(/[\s-]+/g,"")}
function checksum(v){
 const sum=[...v].reduce((total,ch,i)=>total+
  (/[0-9]/.test(ch)?Number(ch):letterValues[ch])*weights[i],0);
 const rem=sum%11;
 return rem===10?"X":String(rem);
}
function check(v){
 const vin=clean(v);
 if(!vin)return {valid:false,vin,reason:"Keine VIN eingegeben."};
 if(vin.length!==17)return {valid:false,vin,reason:"Eine VIN muss genau 17 Zeichen haben."};
 if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return {
  valid:false,vin,reason:"Ungültige VIN-Zeichen: I, O und Q sind nicht erlaubt."
 };
 if(/^([A-Z0-9])\1{16}$/.test(vin))return {
  valid:false,vin,reason:"Die VIN enthält offensichtlich keine realistische Zeichenfolge."
 };
 const expected=checksum(vin),checkdigitValid=vin[8]===expected;
 // WMI ranges 1–5 normally cover North-American production, with check digit as a legal requirement for US-market vehicles.
 const northAmerican=/^[1-5]/.test(vin);
 if(northAmerican&&!checkdigitValid)return {
  valid:false,vin,checkdigitValid,required:true,
  reason:"Prüfziffer an Position 9 stimmt nicht. Bitte die VIN auf Tippfehler prüfen."
 };
 return {valid:true,vin,checkdigitValid,required:northAmerican,
  checksumText:checkdigitValid?"VIN-Prüfziffer mathematisch korrekt":
   "Internationale VIN: US-Prüfziffer nicht bestätigt (nicht überall vorgeschrieben)"};
}
const normalized=s=>String(s||"").toUpperCase().normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]/g,"");
function makeKey(s){
 let v=normalized(s);
 if(["VW","VOLKSWAGEN"].includes(v))v="VOLKSWAGEN";
 if(["MERCEDESBENZ","MERCEDES","MB"].includes(v))v="MERCEDESBENZ";
 if(["SKODA","SKODAAUTO"].includes(v))v="SKODA";
 if(v==="MINICOOPER")v="MINI";
 if(v==="LANDROVER")v="LANDROVER";
 return v;
}
function modelKey(s){
 let v=normalized(s);
 const bmw=v.match(/^([1-8])(?:SERIES|ER)$/);
 if(bmw)return bmw[1]+"SERIES";
 const mer=v.match(/^([ABCESG])(?:KLASSE|CLASS)$/);
 if(mer)return mer[1]+"CLASS";
 if(/^MODEL[3SXY]$/.test(v))return v;
 return v;
}
function matchesModel(selected,decoded){
 const a=modelKey(selected),b=modelKey(decoded);
 if(!a||!b)return null;
 if(a===b)return true;
 // Trims such as Golf GTI, Civic Hatchback etc. are related but not an exact variant match.
 if(a.length>=4&&b.length>=4&&(a.startsWith(b)||b.startsWith(a)))return null;
 return false;
}
function profile(row){
 const get=k=>{const v=String(row?.[k]||"").trim();
  return ["NOT APPLICABLE","NOT AVAILABLE","UNKNOWN","NULL","0"].includes(v.toUpperCase())?"":v};
 return {make:get("Make"),model:get("Model"),year:get("ModelYear"),
  engine:get("EngineModel"),displacement:get("DisplacementL"),
  fuel:get("FuelTypePrimary"),trim:get("Trim"),
  errorCode:get("ErrorCode"),errorText:get("ErrorText"),
  vehicleType:get("VehicleType")};
}
function compare(decoded,selection){
 const conflicts=[],uncertain=[],confirmed=[];
 if(decoded.make&&selection.make){
  if(makeKey(decoded.make)!==makeKey(selection.make))conflicts.push("Marke");
  else confirmed.push("Marke");
 }else uncertain.push("Marke");
 if(decoded.model&&selection.model){
  const match=matchesModel(selection.model,decoded.model);
  if(match===false)conflicts.push("Modell");
  else if(match===true)confirmed.push("Modell");
  else uncertain.push("Modellvariante");
 }else uncertain.push("Modell");
 if(decoded.year&&selection.year){
  if(Number(decoded.year)!==Number(selection.year))conflicts.push("Modelljahr");
  else confirmed.push("Modelljahr");
 }else uncertain.push("Modelljahr");
 return {conflicts,uncertain,confirmed};
}
window.CarPartsVIN={check,profile,compare,makeKey,modelKey,matchesModel};
})();