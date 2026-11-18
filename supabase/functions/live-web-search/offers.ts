import {parseHTML} from "npm:linkedom@0.18.12";

const frankfurt="https://shop.autoersatzteile-frankfurt.de";
const kunzmann="https://www.kunzmann.de";
const merchantDomains=new Set(["www.autodoc.de","www.kfzteile24.de","www.atp-autoteile.de","www.motointegrator.de","www.autoteiledirekt.de","www.pkwteile.de","www.mister-auto.de","www.daparto.de",new URL(frankfurt).hostname,new URL(kunzmann).hostname]);
const discPages=[
 frankfurt+"/BREMBO-Bremsscheibe-VORNE-MERCEDES-BENZ-S-KLASSE-W222-A217-C217-AMG",
 kunzmann+"/shop/de-de/p/s63-s65-amg-bremsscheiben-satz-vorne-s-klasse-w222-original-mercedes-benz-33967.htm"
];
const words=(s:string)=>s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g," ").trim();
type Vehicle={make:string;model:string;series:string;engine:string;year:number;variant:string};
type Source={url:string;condition:string};
const categories:Record<string,string>={
 "bremsscheiben":"Bremsscheibe","bremsbelage":"Bremsbeläge","olfilter":"Ölfilter",
 "luftfilter":"Luftfilter","kraftstofffilter":"Kraftstofffilter","innenraumfilter":"Innenraumfilter",
 "zundkerzen":"Zündkerze","stossdampfer":"Stoßdämpfer","wasserpumpen":"Wasserpumpe"
};
async function shopPage(url:string){
 const u=new URL(url);
 if(u.protocol!=="https:"||u.port||u.username||u.password||!merchantDomains.has(u.hostname))return null;
 const r=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(4500),headers:{Accept:"text/html"}});
 if(!r.ok||!r.headers.get("content-type")?.includes("text/html"))return null;
 const reader=r.body?.getReader();if(!reader)return null;
 const decoder=new TextDecoder();let html="",size=0;
 try{
  for(;;){const {value,done}=await reader.read();if(done)break;
   size+=value.length;if(size>2500000){await reader.cancel();return null}html+=decoder.decode(value,{stream:true});
  }
 }finally{reader.releaseLock()}
 return parseHTML(html+decoder.decode()).document;
}
function metadata(doc:ReturnType<typeof parseHTML>["document"],key:string){
 return doc.querySelector('meta[property="'+key+'"],meta[name="'+key+'"],meta[itemprop="'+key+'"]')?.getAttribute("content")||"";
}
function safeUrl(raw:string,base:string){
 try{const u=new URL(raw,base);return raw && u.protocol==="https:"&&!u.username&&!u.password?u.href:""}catch{return ""}
}
async function product(source:Source){
 const doc=await shopPage(source.url);if(!doc)return null;
 const nodes:any[]=[];
 for(const script of doc.querySelectorAll('script[type="application/ld+json"]')){
  try{const data=JSON.parse(script.textContent||"null");
   for(const item of [data].flat()){if(item)nodes.push(item,...(Array.isArray(item["@graph"])?item["@graph"]:[]))}
  }catch{/* Some shops include unrelated malformed metadata. */}
 }
 const item=nodes.find(n=>[n["@type"]].flat().includes("Product"));
 const offers=[item?.offers].flat().filter(Boolean);
 const offer=offers.find(o=>o.price!=null);
 const price=Number(String(offer?.price??(metadata(doc,"product:price:amount")||metadata(doc,"price"))).replace(",","."));
 const currency=String(offer?.priceCurrency||metadata(doc,"product:price:currency")||metadata(doc,"priceCurrency"));
 const image=[item?.image].flat()[0];
 const imageUrl=safeUrl((typeof image==="string"?image:image?.url)||metadata(doc,"og:image"),source.url);
 const name=String(item?.name||doc.querySelector("h1")?.textContent||"").trim();
 if(!name||!Number.isFinite(price)||price<=0||currency!=="EUR"||!imageUrl)return null;
 return {name:name.slice(0,200),price,currency,image:imageUrl,url:source.url,
  merchant:new URL(source.url).origin===kunzmann?"Autohaus Kunzmann":new URL(source.url).origin===frankfurt?"Autoersatzteile Frankfurt":new URL(source.url).hostname,
  sku:String(item?.sku||metadata(doc,"sku")||"").slice(0,90),condition:source.condition,
  observed_at:new Date().toISOString()};
}
function seedSources(v:Vehicle,term:string){
 const profile=words([v.model,v.series,v.engine].join(" "));
 if(!words(v.make).includes("mercedes")||!/(?:s klasse|s class|w222|v222)/.test(profile)||
  !/bremsscheib|brake (disc|rotor)/.test(words(term))||/hinten|hinterachse|rear/.test(words(term))||
  v.year<2013||v.year>2020||!/\bs ?6[35]\b|\b612 (hp|ps)\b/.test(profile)||
  /coupe|cabrio|keramik|ceramic/.test(words(profile+" "+v.variant+" "+term)))return [];
 return discPages.map(url=>({url,condition:"Händlerzuordnung: S 63 AMG, Baureihe 222, Vorderachse. Bremssystem und OE-Nummer am Fahrzeug abgleichen."}));
}
async function discover(v:Vehicle,term:string,category:string,reference?:string):Promise<Source[]>{
 const part=categories[words(category)]||term;
 const code=v.series.match(/\b[A-Z]{1,2}\s?\d{2,3}\b/i)?.[0];
 const vehicle=code||v.model;
 const query=reference||[part,vehicle].join(" ");
 const doc=await shopPage(frankfurt+"/?qs="+encodeURIComponent(query));if(!doc)return [];
 const list:Source[]=[];
 for(const a of doc.querySelectorAll('.productbox a[href],.product-wrapper a[href],a[itemprop="url"]')){
  const url=safeUrl(a.getAttribute("href")||"",frankfurt);
  if(!url.startsWith(frankfurt+"/")||new URL(url).search||list.some(s=>s.url===url))continue;
  const description=words(decodeURI(new URL(url).pathname)+" "+a.textContent);
  const fits=reference && description.replace(/ /g,"").includes(words(reference).replace(/ /g,""));
  const model=words(vehicle);const localModel=model.replace("class","klasse");
  if(!fits&&(!description.includes(words(part).slice(0,-1)||words(part))||
   ![model,localModel].some(x=>(" "+description+" ").includes(" "+x+" "))))continue;
  list.push({url,condition:"Suchtreffer des Händlers. Motor, Ausstattung und Teilenummer vor dem Kauf abgleichen."});
  if(list.length===3)break;
 }
 return list;
}
export async function searchOffers(v:Vehicle,term:string,category:string,reference?:string){
 let pages=seedSources(v,term);
 if(!pages.length)pages=await discover(v,term,category,reference);
 const rows=await Promise.allSettled(pages.map(product));
 return rows.flatMap(row=>row.status==="fulfilled"&&row.value?[row.value]:[]);
}

export async function webOffers(hits:{url:string}[]){
 const pages=hits.filter(hit=>{try{return merchantDomains.has(new URL(hit.url).hostname)}catch{return false}}).slice(0,3);
 const rows=await Promise.allSettled(pages.map(hit=>product({url:hit.url,condition:"Händler-Suchtreffer. Fahrzeugzuordnung und OE-Nummer prüfen."})));
 return rows.flatMap(r=>r.status==="fulfilled"&&r.value?[r.value]:[]);
}
