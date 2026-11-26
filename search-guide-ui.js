// The form changes search criteria, never the evidence status of a part by itself.
export function renderSearchGuide(container,plan,details,onApply,{onSkip}={}) {
  container.replaceChildren();
  container.hidden=!plan;
  if (!plan) return;
  const heading=document.createElement("h3");
  heading.textContent=plan.status==="reference_match" ? "Abgleich mit Herstellerdaten" : plan.status==="application_found" ? "Gefundene Herstelleranwendungen" : plan.status==="needs_source" ? "Recherche zu deinem Fahrzeug" : "Welche Ausführung brauchst du?";
  const intro=document.createElement("p");
  intro.textContent=plan.message||"Ergänze bekannte Angaben für genauere Treffer. Unbekannte Angaben bitte frei lassen.";
  container.append(heading,intro);
  if (Object.keys(details).length) {
    const reset=document.createElement("button");reset.type="button";reset.className="search-guide-skip search-guide-reset";
    reset.textContent="Zusatzangaben zurücksetzen";reset.onclick=()=>onApply({});container.append(reset);
  }
  if (!plan.questions?.length) return;
  const form=document.createElement("form");
  form.className="search-guide-form";
  const advanced=document.createElement("details");advanced.className="search-guide-advanced";
  const summary=document.createElement("summary");summary.textContent="Teilenummer oder Ausstattungscode vorhanden? (optional)";advanced.append(summary);
  for (const question of plan.questions) {
    const label=document.createElement("label"),title=document.createElement("span"),help=document.createElement("small");
    title.textContent=question.label;help.textContent=question.help;
    let field;
    if (question.options?.length) {
      field=document.createElement("select");
      field.add(new Option("Unbekannt / bitte auswählen",""));
      for (const option of question.options) field.add(new Option(option.label,option.value));
    } else {
      field=document.createElement("input");field.type="text";field.maxLength=question.max_length||40;
      field.autocomplete="off";
    }
    field.name=question.key;field.value=details[question.key]||"";
    const id="search-guide-"+question.key;
    field.id=id;label.htmlFor=id;help.id=id+"-help";field.setAttribute("aria-describedby",help.id);
    label.append(title,field,help);
    if(question.optional || ["oe_number","equipment_code"].includes(question.key))advanced.append(label);else form.append(label);
  }
  if(advanced.children.length>1)form.append(advanced);
  const notice=document.createElement("p");notice.setAttribute("role","status");
  const submit=document.createElement("button");submit.type="submit";submit.className="primary-btn";submit.textContent="Angaben prüfen und erneut suchen";
  if(!plan.questions.some(question=>!question.optional && !["oe_number","equipment_code"].includes(question.key))){
    submit.textContent="Zusatzangaben anwenden";advanced.append(notice,submit);
  }else form.append(notice,submit);
  form.onsubmit=async event=>{
    event.preventDefault();
    const next={...details};
    for (const question of plan.questions) {
      const value=form.elements.namedItem(question.key).value.trim();
      if(value)next[question.key]=value;else delete next[question.key];
    }
    if(JSON.stringify(next)===JSON.stringify(details)){notice.textContent="Ergänze bitte eine bekannte Angabe oder recherchiere mit den vorhandenen Daten weiter.";return;}
    submit.disabled=true;notice.textContent="Angaben werden geprüft…";
    try {await onApply(next);}catch(error){notice.textContent=error.message||"Angaben konnten nicht übernommen werden.";submit.disabled=false;}
  };
  container.append(form);
  if(onSkip && plan.status==="needs_details"){
    const skip=document.createElement("button");skip.type="button";skip.className="search-guide-skip";skip.textContent="Mit vorhandenen Angaben recherchieren";
    skip.onclick=()=>onSkip();container.append(skip);
  }
}
