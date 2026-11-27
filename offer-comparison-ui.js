import {buildComparison,comparisonRecommendations,sortComparison,cheaperIdentical} from "./offer-comparison.js?v=47";
const euros=value=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(value);
function el(tag,className,content){const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node;}
function link(label,url,className=""){const node=el("a",className,label);node.href=url;node.target="_blank";node.rel="noopener noreferrer";return node;}
function ratingLabel(row){return row.rating?`${row.rating.value.toLocaleString("de-DE")} / ${row.rating.best} · ${row.rating.count} Produktbewertungen`:"Keine belegten Produktbewertungen";}
const conditions={new:"Neuware laut Händler",used:"Gebraucht laut Händler",refurbished:"Überholt laut Händler",damaged:"Beschädigt laut Händler",unknown:"Zustand nicht angegeben"};
const unresolvedNames={axle:"Achse",side:"Einbauseite",source:"Herstellerquelle",equipment_code:"Ausstattungscode"};
function card(row,rows,recommendations){
 const article=el("article","comparison-card");article.dataset.url=row.url;
 const visual=el("div","comparison-visual");
 const missing=()=>{visual.replaceChildren(el("span","comparison-no-photo","Kein Produktbild verfügbar"));};
 if(row.image){const img=el("img");img.src=row.image;img.alt=row.name;img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";img.addEventListener("error",missing,{once:true});visual.append(img);visual.append(el("span","comparison-photo-note","Produktfoto vom Händler"));}else missing();
 article.append(visual);
 const body=el("div","comparison-body"),badges=el("div","comparison-badges");
 const recommendationsText=[["price","Niedrigster Artikelpreis"],["quality","Bewertungs-Tipp"],["value","Preis & Bewertung"]];
 for(const [kind,label] of recommendationsText)if(recommendations[kind]?.url===row.url)badges.append(el("span","comparison-badge",label));
 if(badges.childElementCount)body.append(badges);
 body.append(el("p","comparison-merchant",row.merchant),el("h3","",row.name));
 const status=row.fitment==="reference_match"?"Teilenummer & Herstelleranwendung abgeglichen":row.fitment==="application_found"?"Herstelleranwendung · Ausführung abgleichen":"Recherchetreffer · Passform offen";
 body.append(el("p","comparison-fitment",status));
 if(row.unresolved.length)body.append(el("p","comparison-open","Noch offen: "+row.unresolved.map(item=>unresolvedNames[item]||item).join(", ")));
 if(row.description)body.append(el("p","comparison-description",row.description));
 if(row.sku)body.append(el("p","comparison-detail","Art.-Nr. "+row.sku));
 const price=el("div","comparison-price");price.append(el("strong","",row.price===null?"Preis nicht verfügbar":euros(row.price)));
 price.append(el("span","",row.price===null?(row.kind==="source"?"Quelle liefert noch kein konkretes Produktangebot":"Kein auslesbarer EUR-Preis beim Händler"):"Artikelpreis laut Händler"));body.append(price);
 if(row.kind==="product"){
  const facts=el("dl","comparison-facts");
  for(const [label,value] of [["Versand (DE)",row.shipping===null?"Nicht angegeben":euros(row.shipping)],["Gesamt",row.total===null?"Inkl. Versand noch offen":euros(row.total)],["Lieferumfang",row.quantity?row.quantity+" Stück pro Angebot":"Stück / Satz beim Händler prüfen"],["Bewertung",ratingLabel(row)],["Zustand",conditions[row.itemCondition]||conditions.unknown]]){facts.append(el("dt","",label),el("dd","",value));}
  if(row.availability)facts.append(el("dt","","Verfügbarkeit"),el("dd","",row.availability.replace(/([a-z])([A-Z])/g,"$1 $2")));
  body.append(facts);
  if(row.rating)body.append(el("p","comparison-detail","Händlerangaben zu diesem Produkt; kein unabhängiger Qualitätstest."));
  if(row.condition){const details=el("details","comparison-conditions");details.append(el("summary","","Angaben zur Fahrzeuganwendung"),el("p","",row.condition));body.append(details);}
  const when=Date.parse(row.observedAt);if(Number.isFinite(when))body.append(el("p","comparison-detail","Preisstand: "+new Date(when).toLocaleString("de-DE")));
  if(row.factsAt)body.append(el("p","comparison-detail","Weitere Produktangaben: Stand "+new Date(row.factsAt).toLocaleString("de-DE")));
  const cheaper=cheaperIdentical(row,rows);if(cheaper)body.append(link("Gleiches Teil, gleicher Lieferumfang bei "+cheaper.merchant+": "+euros(cheaper.price),cheaper.url,"comparison-alternative"));
 }
 const actions=el("div","comparison-actions");actions.append(link(row.kind==="source"?"Quelle öffnen ↗":"Zum Händler ↗",row.url,"comparison-buy"));
 if(row.sourceUrl)actions.append(link("Herstellerbeleg ↗",row.sourceUrl));body.append(actions);article.append(body);return article;
}

export function renderOfferComparison(container,data={},options={}){
 const rows=buildComparison(data);container.replaceChildren();container.hidden=!rows.length;
 if(!rows.length)return {rows};
 const now=options.now??Date.now(),recommendations=comparisonRecommendations(rows,now);
 const heading=el("header","comparison-heading");heading.append(el("span","eyebrow","ANGEBOTE IM VERGLEICH"),el("h3","","Preis, Produktbild und Bewertungen auf einen Blick"));
 heading.append(el("p","",`${rows.length} Treffer · ${rows.filter(row=>row.price!==null).length} mit EUR-Preis · ${rows.filter(row=>row.image).length} mit Produktfoto`));
 if(data.sources?.length&&data.provider==="serper")heading.append(el("p","comparison-detail","Weitere Webquellen: Serper · Google-Suchergebnisse"));container.append(heading);
 const tips=el("div","comparison-tips");
 for(const [kind,label,empty] of [["price","Preis-Tipp","Noch kein aktuelles Angebot mit ausreichendem Fahrzeugabgleich."],["quality","Qualität / Bewertungen","Noch keine belastbare Empfehlung: ausreichend viele Produktbewertungen fehlen."],["value","Preis & Bewertung","Noch kein abgeglichenes Angebot mit mindestens 4 von 5 bei 5 Produktbewertungen."]]){
  const tip=el("div","comparison-tip");tip.append(el("span","",label));const row=recommendations[kind];
  if(row){tip.append(link(row.name,row.url),el("strong","",kind==="quality"?ratingLabel(row):euros(row.price)+" · "+row.merchant));if(kind!=="price")tip.append(el("small","",kind==="quality"?"Höchste belegte Händlerbewertung unter den abgeglichenen Angeboten.":"Niedrigster Artikelpreis mit mindestens 4 / 5 bei 5 Produktbewertungen."));}
  else tip.append(el("p","",empty));tips.append(tip);
 }
 container.append(tips,el("p","comparison-explainer","Preis-Tipp: niedrigster gelesener Artikelpreis bei gefundener Herstelleranwendung, ohne bekannte offene Abgleichpunkte, höchstens 24 Stunden alt. Lieferumfang und Versand können abweichen. Bewertungen stammen vom Händler und belegen keine Haltbarkeit. Eine Marke oder ein höherer Preis allein ergibt keine Qualitätsauszeichnung."));
 const controls=el("div","comparison-controls"),label=el("label","","Sortieren nach"),select=el("select");select.setAttribute("aria-label","Angebote sortieren");
 for(const [value,name] of [["recommended","Fahrzeugabgleich & Preis"],["price","Artikelpreis aufsteigend"],["total","Gesamtpreis inkl. bekanntem Versand"],["rating","Produktbewertungen"],["value","Preis & Bewertung"]]){const option=el("option","",name);option.value=value;select.append(option);}label.append(select);controls.append(label);
 const filterLabel=el("label","comparison-filter"),filter=el("input");filter.type="checkbox";filterLabel.append(filter,el("span","","Nur Treffer mit Preis"));controls.append(filterLabel);container.append(controls);
 const status=el("p","comparison-count");status.setAttribute("role","status");const grid=el("div","comparison-grid");container.append(status,grid);
 const paint=()=>{const visible=sortComparison(rows,select.value,now).filter(row=>!filter.checked||row.price!==null);status.textContent=visible.length+" von "+rows.length+" Treffern";grid.replaceChildren(...visible.map(row=>card(row,rows,recommendations)));if(!visible.length)grid.append(el("p","comparison-empty","Für diese Treffer ist noch kein EUR-Preis verfügbar. Öffne die Quelle oder deaktiviere den Preisfilter."));};
 select.onchange=paint;filter.onchange=paint;paint();return {rows,recommendations};
}
