import {buildComparison,comparisonRecommendations,sortComparison,cheaperIdentical,completeOffer} from "./offer-comparison.js?v=49";
const euros=value=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(value);
function el(tag,className,content){const node=document.createElement(tag);if(className)node.className=className;if(content!==undefined)node.textContent=content;return node;}
function link(label,url,className=""){const node=el("a",className,label);node.href=url;node.target="_blank";node.rel="noopener noreferrer";return node;}
function ratingLabel(row){return row.rating?`${row.rating.value.toLocaleString("de-DE")} / ${row.rating.best} · ${row.rating.count} Produktbewertungen`:"Noch keine Produktbewertungen";}
const conditions={new:"Neuware laut Anbieter",used:"Gebraucht laut Anbieter",refurbished:"Überholt laut Anbieter",damaged:"Beschädigt laut Anbieter",unknown:"Zustand beim Händler prüfen"};
const unresolvedNames={axle:"Achse",side:"Einbauseite",source:"Herstellerquelle",equipment_code:"Ausstattungscode"};
function photo(row,onError){const image=el("img");image.src=row.image;image.alt=row.name;image.loading="lazy";image.decoding="async";image.referrerPolicy="no-referrer";image.addEventListener("error",()=>onError(row),{once:true});return image;}
function card(row,rows,recommendations,onPhotoError){
 const article=el("article","comparison-card");article.dataset.url=row.url;
 const visual=el("div","comparison-visual");visual.append(photo(row,onPhotoError),el("span","comparison-photo-note",row.imageSource?"Vorschaubild · "+row.imageSource:"Produktfoto vom Händler"));article.append(visual);
 const body=el("div","comparison-body"),badges=el("div","comparison-badges");
 if(recommendations.featured?.url===row.url)badges.append(el("span","comparison-badge comparison-recommended-badge","Empfohlen"));
 if(recommendations.price?.url===row.url)badges.append(el("span","comparison-badge","Preis-Tipp"));if(badges.childElementCount)body.append(badges);
 body.append(el("p","comparison-merchant",row.merchant),el("h3","",row.name));
 const status=row.fitment==="reference_match"?"Teilenummer & Herstelleranwendung abgeglichen":row.fitment==="cross_reference_found"?"OE-Referenz dokumentiert · Ausführung abgleichen":row.fitment==="application_found"?"Herstelleranwendung · Ausführung abgleichen":"Angebot gefunden · Passform noch prüfen";
 body.append(el("p","comparison-fitment",status));
 if(row.unresolved.length)body.append(el("p","comparison-open","Noch offen: "+row.unresolved.map(item=>unresolvedNames[item]||item).join(", ")));
 if(row.description&&row.description!==row.name)body.append(el("p","comparison-description",row.description));
 if(row.manufacturer)body.append(el("p","comparison-detail","Hersteller: "+row.manufacturer));if(row.sku)body.append(el("p","comparison-detail","Art.-Nr. "+row.sku));
 const price=el("div","comparison-price");price.append(el("strong","",euros(row.price)),el("span","",row.priceSource?"Artikelpreis · "+row.priceSource:"Artikelpreis laut Händler"));body.append(price);
 const facts=el("dl","comparison-facts");
 for(const [label,value] of [["Versand (DE)",row.shipping===null?row.deliveryNote||"Beim Händler prüfen":euros(row.shipping)],["Gesamt",row.total===null?"Versand noch offen":euros(row.total)],["Lieferumfang",row.quantity?row.quantity+" Stück pro Angebot":"Stück / Satz beim Händler prüfen"],["Bewertung",ratingLabel(row)],["Zustand",conditions[row.itemCondition]||conditions.unknown]])facts.append(el("dt","",label),el("dd","",value));
 if(row.availability)facts.append(el("dt","","Verfügbarkeit"),el("dd","",row.availability.replace(/([a-z])([A-Z])/g,"$1 $2")));
 body.append(facts);
 if(row.rating)body.append(el("p","comparison-detail","Produktbewertungen laut "+(row.ratingSource||"Händler")+"; kein unabhängiger Material- oder Haltbarkeitstest."));
 if(row.condition){const details=el("details","comparison-conditions");details.append(el("summary","","Fahrzeuganwendung ansehen"),el("p","",row.condition));body.append(details);}
 const when=Date.parse(row.observedAt);if(Number.isFinite(when))body.append(el("p","comparison-detail","Preisstand: "+new Date(when).toLocaleString("de-DE")));
 if(row.factsAt)body.append(el("p","comparison-detail","Weitere Angaben: Stand "+new Date(row.factsAt).toLocaleString("de-DE")));
 const cheaper=cheaperIdentical(row,rows);if(cheaper)body.append(link("Gleiches Teil und gleicher Lieferumfang bei "+cheaper.merchant+": "+euros(cheaper.price),cheaper.url,"comparison-alternative"));
 const actions=el("div","comparison-actions");actions.append(link(row.offerLinkType==="shopping"?"Angebot bei Google Shopping ↗":"Zum Händler ↗",row.url,"comparison-buy"));if(row.sourceUrl)actions.append(link("Herstellerbeleg ↗",row.sourceUrl));body.append(actions);article.append(body);return article;
}
function featuredPanel(rows,recommendations,onPhotoError){
 const panel=el("section","comparison-featured");panel.setAttribute("aria-label","Qualitätsempfehlung");const row=recommendations.featured;
 if(!row){panel.classList.add("comparison-featured-empty");panel.append(el("h3","","Empfohlen"),el("p","","Für diese Auswahl liegt noch keine belegte Qualitätsempfehlung vor. Sobald ein aktuelles Angebot mit Herstellerbeleg oder dokumentierter OE-Querverbindung und genügend guten Produktbewertungen vorliegt, erscheint es hier."));return panel;}
 const visual=el("div","comparison-featured-photo");visual.append(photo(row,onPhotoError));const body=el("div","comparison-featured-body");
 body.append(el("span","comparison-badge comparison-recommended-badge","Empfohlen"),el("h3","",row.name),el("p","comparison-featured-price",euros(row.price)+" · "+row.merchant),el("p","",ratingLabel(row)));
 body.append(el("p","comparison-featured-reason","Warum empfohlen: "+(row.fitment==="cross_reference_found"?"OE-Referenz mit dokumentierter Fahrzeuganwendung verknüpft":"Herstelleranwendung gefunden")+", keine bekannten offenen Abgleichpunkte und mindestens 4 / 5 aus mindestens 5 Produktbewertungen. Die Rangfolge berücksichtigt auch die Anzahl der Bewertungen."));
 body.append(link(row.offerLinkType==="shopping"?"Empfohlenes Angebot bei Google Shopping ↗":"Empfohlenes Angebot ansehen ↗",row.url,"comparison-buy"));panel.append(visual,body);return panel;
}
export function renderOfferComparison(container,data={},options={}){
 const rows=buildComparison(data);container.replaceChildren();container.hidden=!rows.length;if(!rows.length)return {rows,offers:[]};
 const now=options.now??Date.now(),failed=new Set();let mode="recommended",merchant="",manufacturer="";
 const state={rows,offers:rows.filter(completeOffer)};
 const paint=()=>{
  const offers=rows.filter(row=>completeOffer(row)&&!failed.has(row.url));state.offers=offers;const incomplete=rows.filter(row=>!offers.includes(row));
  const recommendations=comparisonRecommendations(offers,now);state.recommendations=recommendations;
  const focus=document.activeElement?.getAttribute("aria-label");container.replaceChildren();
  const onPhotoError=row=>{if(!failed.has(row.url)){failed.add(row.url);paint();}};
  const heading=el("header","comparison-heading");heading.append(el("span","eyebrow","PREISE & QUALITÄT VERGLEICHEN"),el("h3","","Konkrete Angebote mit Preis und Produktfoto"),el("p","",offers.length+" Angebote · "+new Set(offers.map(row=>row.merchant)).size+" Händler · "+new Set(offers.map(row=>row.manufacturer).filter(Boolean)).size+" bekannte Hersteller"));container.append(heading,featuredPanel(offers,recommendations,onPhotoError));
  const controls=el("div","comparison-controls");
  const selectControl=(name,labelText,choices,current,onChange)=>{
   const label=el("label","",labelText),select=el("select");select.setAttribute("aria-label",name);
   for(const [value,text] of choices){const option=el("option","",text);option.value=value;if(value===current)option.selected=true;select.append(option);}label.append(select);select.onchange=()=>{onChange(select.value);paint();};controls.append(label);
  };
  selectControl("Angebote sortieren","Sortieren nach",[["recommended","Empfehlung & Fahrzeugabgleich"],["price","Artikelpreis aufsteigend"],["total","Gesamtpreis bei bekanntem Versand"],["rating","Produktbewertungen"],["value","Preis & Bewertung"]],mode,value=>mode=value);
  if(new Set(offers.map(row=>row.merchant)).size>1)selectControl("Händler filtern","Händler",[["","Alle Händler"],...[...new Set(offers.map(row=>row.merchant))].sort().map(name=>[name,name])],merchant,value=>merchant=value);
  if(new Set(offers.map(row=>row.manufacturer).filter(Boolean)).size>1)selectControl("Hersteller filtern","Hersteller",[["","Alle Hersteller"],...[...new Set(offers.map(row=>row.manufacturer).filter(Boolean))].sort().map(name=>[name,name])],manufacturer,value=>manufacturer=value);
  if(offers.length)container.append(controls);
  const visible=sortComparison(offers,mode,now).filter(row=>(!merchant||row.merchant===merchant)&&(!manufacturer||row.manufacturer===manufacturer));
  const count=el("p","comparison-count",visible.length+" von "+offers.length+" Angeboten mit Preis und Foto");count.setAttribute("role","status");container.append(count);
  const grid=el("div","comparison-grid");grid.append(...visible.map(row=>card(row,offers,recommendations,onPhotoError)));container.append(grid);
  if(!visible.length)grid.append(el("p","comparison-empty",offers.length?"Für diese Filterauswahl gibt es kein Angebot.":"Noch kein konkretes Angebot mit Preis und abrufbarem Produktfoto gefunden. Die verfügbaren Quellen stehen unten."));
  if(incomplete.length){
   const details=el("details","comparison-incomplete");details.append(el("summary","","Weitere Quellen ohne vollständiges Produktangebot ("+incomplete.length+")"));
   const list=el("ul");for(const row of incomplete){const item=el("li");item.append(link(row.name+" · "+row.merchant,row.url),el("span","",failed.has(row.url)?"Produktfoto nicht abrufbar":row.kind==="source"?"Kategorie oder Quelle, noch kein einzelnes Angebot":row.price===null?"Kein konkreter EUR-Preis verfügbar":"Produktfoto fehlt"));list.append(item);}details.append(list);container.append(details);
  }
  const method=el("details","comparison-method");method.append(el("summary","","Wie Preise und Empfehlungen entstehen"),el("p","","Verglichen werden die gefundenen Angebote, kein vollständiger Marktüberblick. Artikelpreise können unterschiedliche Lieferumfänge haben; Versand und Stückzahl werden gesondert angezeigt. „Empfohlen“ stützt sich auf Herstellerzuordnung und belegte Produktbewertungen. Ein höherer Preis oder ein Markenname allein erzeugt keine Qualitätsempfehlung. Bewertungsrangfolge: Mittelwert mit Gewichtung nach Anzahl und einem Vergleichsprior von 3,5 / 5 bei 20 Bewertungen. Das ersetzt keinen unabhängigen Qualitätstest."));
  if(data.provider==="serper")method.append(el("p","","Zusätzliche Quellen und Produktangebote: Serper / Google Shopping. Preis und Vorschaubild bleiben dem jeweiligen Anbieter zugeordnet."));container.append(method);
  if(focus)container.querySelector('[aria-label="'+focus+'"]')?.focus();
 };
 paint();return state;
}
