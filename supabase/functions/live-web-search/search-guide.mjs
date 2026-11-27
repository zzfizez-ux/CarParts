import {hasPartNumber, partNumber, seriesEvidence, words} from "./vehicle-fitment.mjs?v=48";

const limits = {engine:160, oe_number:40, axle:10, side:10, equipment_code:3};
const enums = {axle:["front","rear"], side:["left","right"]};
export function validateSearchDetails(input = {}) {
  if (!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).some(key=>!(key in limits)))
    throw new Error("Invalid search details");
  const result = {};
  for (const [key,value] of Object.entries(input)) {
    if (typeof value!=="string" || value.length>limits[key] ||
        !/^[\p{L}\p{N}\p{M} &'’.,+()#:/_–—-]*$/u.test(value) || /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(value))
      throw new Error("Invalid search details");
    const text=value.normalize("NFKC").trim().replace(/\s+/g," ");
    if (!text) continue;
    if (enums[key] && !enums[key].includes(text)) throw new Error("Invalid search details");
    if (key==="equipment_code" && !/^[A-Z0-9]{3}$/i.test(text)) throw new Error("Invalid equipment code");
    if (key==="oe_number" && (!/^[A-Z0-9 ._/-]+$/i.test(text) || partNumber(text).length<4 || !/\d/.test(text)))
      throw new Error("Invalid part number");
    result[key] = key==="equipment_code" ? text.toUpperCase() : text;
  }
  return result;
}

export const effectiveVehicle = (vehicle,details={}) => ({...vehicle,engine:details.engine||vehicle.engine||""});

function position(text) {
  const value=words(text);
  return {
    axle:/\b(vorne|vorn|vorderachse|front)\b/.test(value) ? "front"
      : /\b(hinten|hinterachse|rear)\b/.test(value) ? "rear" : "",
    side:/\b(links|left)\b/.test(value) ? "left" : /\b(rechts|right)\b/.test(value) ? "right" : ""
  };
}
export function selectedDetails(term,details={}) {
  const selected=position(term);
  return {...details,axle:details.axle||selected.axle,side:details.side||selected.side};
}
export function requestConflicts(term,details={}) {
  const text=words(term),conflicts=[];
  const axes={front:/\b(vorne|vorn|vorderachse|front)\b/.test(text),rear:/\b(hinten|hinterachse|rear)\b/.test(text)};
  const sides={left:/\b(links|left)\b/.test(text),right:/\b(rechts|right)\b/.test(text)};
  if ((axes.front&&axes.rear) || (details.axle==="front"&&axes.rear) || (details.axle==="rear"&&axes.front)) conflicts.push("axle");
  if ((sides.left&&sides.right) || (details.side==="left"&&sides.right) || (details.side==="right"&&sides.left)) conflicts.push("side");
  return conflicts;
}

// An explicit reference must be visible in the source, or linked through a reviewed cross-reference.
export function matchesRequestedReference(text,requested,applications=[]) {
  if (!requested) return true;
  if (hasPartNumber(text,requested)) return true;
  const key=partNumber(requested);
  return applications.some(row=>[row.manufacturer_part_number,...(row.oe||[])].some(number=>partNumber(number)===key) &&
    hasPartNumber(text,row.manufacturer_part_number));
}

export function conflictsWithApplications(text,excluded=[]) {
  return excluded.some(row=>[row.manufacturer_part_number,...(row.oe||[])].some(number=>hasPartNumber(text,number)));
}

export function filterProducts(products,applications,term,details={},excluded=[]) {
  if(requestConflicts(term,details).length)return [];
  return products.filter(product=>{
    if(requestConflicts(searchTerm(term,details)+" "+product.name).length)return false;
    const matched=applications.filter(row=>row.id===product.part_id && product.evidence==="manufacturer");
    const identity=[product.name,product.sku,product.description,product.url].filter(Boolean).join(" ");
    return !conflictsWithApplications(identity,excluded) && matchesRequestedReference(identity,details.oe_number,matched);
  });
}

export function searchTerm(term,details={}) {
  if(requestConflicts(term,details).length)throw new Error("Einbaupositionen widersprechen sich. Bitte Suchbegriff und Zusatzangaben korrigieren.");
  const inferred=position(term);
  const extras=[];
  if (details.axle && !inferred.axle) extras.push(details.axle==="front"?"vorne":"hinten");
  if (details.side && !inferred.side) extras.push(details.side==="left"?"links":"rechts");
  return [term,...extras].join(" ");
}

export function equipmentCodes(notes) {
  const groups=String(notes||"").matchAll(/\bPR-Codes?:\s*([A-Z0-9, ]+)\./gi);
  return [...new Set([...groups].flatMap(group=>group[1].toUpperCase().split(/[,\s]+/).filter(v=>/^[A-Z0-9]{3}$/.test(v))))];
}

export function assessApplication(row,vehicle,term,details={}) {
  const selected=selectedDetails(term,details),notes=String(row.fitment?.notes||""),codes=equipmentCodes(notes);
  const actual=position(row.part_name);
  const conflicts=requestConflicts(term,details);
  if (selected.axle && actual.axle && selected.axle!==actual.axle) conflicts.push("axle");
  if (selected.side && actual.side && selected.side!==actual.side) conflicts.push("side");
  if (selected.equipment_code && codes.length && !codes.includes(selected.equipment_code)) conflicts.push("equipment_code");
  const numbers=[row.manufacturer_part_number,...(row.oe||[])].map(partNumber);
  const referenceMatch=!!selected.oe_number && numbers.includes(partNumber(selected.oe_number));
  if (selected.oe_number && !referenceMatch) conflicts.push("oe_number");
  if (seriesEvidence(vehicle,row.engine)==="conflict") conflicts.push("series");
  if (row.match!=="exact") conflicts.push("engine_unconfirmed");
  const unresolved=[];
  if (selected.axle && !actual.axle) unresolved.push("axle");
  if (selected.side && !actual.side) unresolved.push("side");
  try { if(new URL(row.fitment?.source_url||row.source_url).protocol!=="https:") unresolved.push("source"); }
  catch { unresolved.push("source"); }
  if (codes.length && !selected.equipment_code) unresolved.push("equipment_code");
  // A reference and a reviewed engine application improve evidence; they never create a blanket guarantee.
  return {
    status:conflicts.length ? "conflict" : referenceMatch && !unresolved.length ? "reference_match" : "application_found",
    conflicts,unresolved,equipment_codes:codes,reference_match:referenceMatch,
    label:referenceMatch && !conflicts.length && !unresolved.length ? "Teilenummer und Herstelleranwendung stimmen überein"
      : "Herstelleranwendung gefunden · Ausführung abgleichen"
  };
}

export function filterApplications(rows,vehicle,term,details={}) {
  return rows.map(row=>({...row,assessment:assessApplication(row,vehicle,term,details)}))
    .filter(row=>!row.assessment.conflicts.some(key=>key!=="engine_unconfirmed"));
}

export function searchPlan(vehicle,term,category,details={},engines=[],applications=[],{preflight=false}={}) {
  if(requestConflicts(term,details).length)return {status:"conflict",questions:[],matched_parts:[],message:"Einbaupositionen widersprechen sich. Bitte Suchbegriff und Zusatzangaben korrigieren."};
  const selected=selectedDetails(term,details),type=words(category||term),questions=[];
  const ask=(key,label,help,options=[])=>questions.push({key,label,help,options,max_length:limits[key],optional:["oe_number","equipment_code"].includes(key)});
  const engine=String(details.engine||vehicle.engine||"");
  if (!engine || (engines.length && !engines.some(row=>words(row.designation)===words(engine)))) {
    ask("engine","Genaue Motorisierung / Elektro-Variante","Motorcode und Leistung stehen z. B. in Fahrzeugunterlagen. Wähle nur die tatsächlich vorhandene Variante.",
      [...new Set(engines.map(row=>row.designation))].map(value=>({value,label:value})));
  }
  if (/brems|brake|stossdampfer|querlenker|radlager|antriebswelle|achse/.test(type) && !selected.axle)
    ask("axle","Vorder- oder Hinterachse?","Die Einbauposition unterscheidet die Ausführungen.",[{value:"front",label:"Vorne"},{value:"rear",label:"Hinten"}]);
  if (/spiegel|scheinwerfer|ruckleucht|querlenker|antriebswelle|spurstangenkopf/.test(type) && !selected.side)
    ask("side","Linke oder rechte Fahrzeugseite?","Links und rechts werden in Fahrtrichtung angegeben.",[{value:"left",label:"Links"},{value:"right",label:"Rechts"}]);
  if (preflight) return {status:questions.length?"needs_details":"ready_to_search",questions};
  const eligible=filterApplications(applications,vehicle,term,details);
  const codes=[...new Set(eligible.flatMap(row=>row.assessment.equipment_codes))];
  if (codes.length && !selected.equipment_code)
    ask("equipment_code","Ausstattungscode (PR-Code), falls bekannt","Nur ergänzen, wenn du den Code bereits kennst. Ohne Code kannst du Angebote ansehen; unklare Ausführungen bleiben gekennzeichnet.");
  if (!selected.oe_number && !eligible.some(row=>row.assessment.status==="reference_match"))
    ask("oe_number","Teilenummer, falls bereits vorhanden","Optional: Eine Original- oder Herstellerteilenummer kann den Abgleich ergänzen. Du musst dafür keine Nummer suchen oder ein Teil ausbauen.");
  const confirmed=eligible.filter(row=>row.assessment.status==="reference_match");
  const needsAnswers=questions.some(question=>!question.optional);
  const hasApplication=eligible.some(row=>row.match==="exact");
  return {
    status:confirmed.length?"reference_match":needsAnswers?"needs_details":hasApplication?"application_found":"needs_source",
    questions,matched_parts:confirmed.map(row=>row.id),
    message:confirmed.length?"Teilenummer und dokumentierte Motoranwendung stimmen überein. Weitere Ausstattungsbedingungen im Herstellerbeleg prüfen."
      : needsAnswers?"Ergänze die bekannten Fahrzeugangaben für genauere Treffer. Eine Teilenummer musst du nicht kennen."
      : hasApplication?"Herstelleranwendungen zu deinen Fahrzeugangaben gefunden. Offene Ausstattungsbedingungen stehen bei den Treffern. Eine Teilenummer ist für die Suche nicht nötig."
      : "Wir suchen mit deinen Fahrzeugangaben weiter. Eine Teilenummer ist nicht nötig. Ohne passenden Herstellerbeleg bleibt die Passform ungeprüft."
  };
}
