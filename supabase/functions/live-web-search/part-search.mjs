// Shared, local query understanding. This suggests names, never vehicle fitment.
const normal=value=>String(value??"").normalize("NFKD").toLowerCase().replace(/\p{M}/gu,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g," ").trim();
const ascii=value=>value.replace(/ä/gi,"ae").replace(/ö/gi,"oe").replace(/ü/gi,"ue").replace(/ß/g,"ss");
const compact=value=>normal(value).replaceAll(" ","");
const definitions=`
Bremsbeläge|Bremsbelag;Bremsklötze;Bremsklotz;Bremssteine;brake pads;brake pad
Bremsscheiben|Bremsscheibe;brake discs;brake disc;brake rotors;brake rotor
Bremssättel|Bremssattel;Bremszange;brake caliper;brake calipers
Bremsschlauch|Bremsschläuche;brake hose;brake hoses
Bremsleitungen|Bremsleitung;brake line
Bremsflüssigkeit|Bremsflüssigkeiten;brake fluid
Hauptbremszylinder|brake master cylinder
Radbremszylinder|wheel brake cylinder;brake wheel cylinder
Bremstrommeln|Bremstrommel;brake drum;brake drums
Bremsbacken|Bremsbacke;brake shoes;brake shoe
Bremsbackensatz|Bremsbacken Satz;brake shoe kit
Bremsbelagverschleißsensor|Warnkontakt;Bremsbelag Warnkontakt;brake pad wear sensor
ABS-Sensor|Raddrehzahlsensor;ABS Radsensor;ABS Sensor;wheel speed sensor
ABS-Steuergerät|ABS Steuergerät;ABS control unit
Ölfilter|Motorölfilter;oil filter;oilfilter
Kraftstofffilter|Dieselfilter;Benzinfilter;Spritfilter;fuel filter
Luftfilter|Motorluftfilter;air filter
Innenraumfilter|Pollenfilter;Klimafilter;cabin filter
Zündkerzen|Zündkerze;spark plugs;spark plug
Glühkerzen|Glühkerze;glow plugs;glow plug
Zündspulen|Zündspule;ignition coil
Zahnriemen|Zahnriemensatz;timing belt
Steuerkette|Steuerkettensatz;timing chain
Keilrippenriemen|Keilrippenriemensatz;Keilriemen;multi v belt;multi v belt kit;serpentine belt
Riemenspanner|Spannrolle;belt tensioner
Wasserpumpe|Kühlmittelpumpe;water pump
Thermostat|Kühlmittelthermostat;thermostat
Kühler|Wasserkühler;Motorkühler;radiator
Kühlmittelschlauch|Kühlerschlauch;coolant hose
Lichtmaschine|Generator;alternator
Anlasser|Starter;Anlassermotor;starter motor
Batterie|Starterbatterie;Autobatterie;12V Batterie;car battery
Stoßdämpfer|Stossdaempfer;Federbeindämpfer;shock absorber;shock absorbers
Fahrwerksfedern|Fahrwerksfeder;Schraubenfeder;Feder;coil spring
Querlenker|Achslenker;Lenker;wishbone;control arm
Spurstangenkopf|Spurstangenköpfe;Spurkopf;tie rod end
Radlager|Radlagersatz;wheel bearing
Koppelstange|Koppelstangen;Stabilisatorstrebe;stabilizer link
Traggelenk|Traggelenke;Führungsgelenk;ball joint
Axialgelenk|Inneres Spurstangengelenk;inner tie rod
Kupplung|Kupplungssatz;Kupplungsscheibe;clutch;clutch kit
Kupplungsgeberzylinder|Kupplungsgeber;Geberzylinder;clutch master cylinder
Kupplungsnehmerzylinder|Kupplungsnehmer;Nehmerzylinder;clutch slave cylinder
Zentralausrücker|Ausrücklager;central clutch release device
Kupplungsaktuator|Kupplungssteller;Kupplung Aktuator;Kupplung Stellmotor;Aktuator Kupplung;clutch actuator
Getriebesteuergerät|Getriebe Steuergerät;Getriebesteuerung;Automatik Steuergerät;Steuergerät Automatikgetriebe;Steuergerät Getriebe;Automatikgetriebesteuergerät;transmission control unit;TCU
Getriebemechatronik|DSG Mechatronik;Mechatronik Getriebe;Mechatronik;Getriebe Mechatronik
Motorsteuergerät|Motor Steuergerät;Motorsteuerung;engine control unit;ECU
Schwungrad|Zweimassenschwungrad;ZMS;flywheel
Getriebeöl|Automatikgetriebeöl;transmission oil;gearbox oil
Getriebefilter|Automatikgetriebefilter;transmission filter
Getriebe|Automatikgetriebe;Schaltgetriebe;gearbox;transmission
Antriebswelle|Antriebswellen;Gelenkwelle;drive shaft;driveshaft
Kardanwelle|Kardan;propeller shaft
Differential|Differenzial;differential
Motoröl|motor oil;engine oil
Dichtungen|Dichtung;gasket
Ölpumpe|oil pump
Kraftstoffpumpe|Benzinpumpe;Dieselpumpe;fuel pump
Scheibenwischer|Wischerblätter;Wischerblatt;Wischergummi;windshield wipers;wiper blades
Scheibenwischermotor|Wischermotor;Motor Scheibenwischer;Scheibenwischer Motor;wiper motor
Scheibenwaschpumpe|Wischwasserpumpe;Waschwasserpumpe;washer pump
Scheinwerfer|Frontscheinwerfer;headlight;headlights
Rückleuchten|Rücklicht;Rückleuchte;Heckleuchte;tail light;taillight
Außenspiegel|Seitenspiegel;side mirror;wing mirror
Scheinwerferhalter|Scheinwerfer Halter
Fahrzeugtür|Tür;Autotür;car door
Türaußenhaut|Tür Außenhaut
Fensterheber|Fensterhebermechanismus;window regulator
Fensterhebermotor|Fensterheber Motor;window motor
Türschloss|Tür Schloss;door lock
Klimakompressor|Klima Kompressor;air conditioning compressor;AC compressor
Kompressor-Ansaugfilter|Kompressor Ansaugfilter
Lambdasonde|Lambda Sonde;Sauerstoffsensor;oxygen sensor
Luftmassenmesser|LMM;Luftmengenmesser;mass air flow sensor;MAF sensor
Turbolader|Turbo;Abgasturbolader;turbocharger
AGR-Ventil|AGR Ventil;Abgasrückführungsventil;EGR valve
Katalysator|Kat;catalytic converter
Partikelfilter|Dieselpartikelfilter;DPF;Rußpartikelfilter;diesel particulate filter
Auspuff|Abgasanlage;Endschalldämpfer;exhaust
Einspritzdüsen|Einspritzdüse;Injektor;Injektoren;fuel injector
Drosselklappe|Drosselklappenstutzen;throttle body
Kurbelwellensensor|Kurbelwellen Sensor;crankshaft sensor
Nockenwellensensor|Nockenwellen Sensor;camshaft sensor
Motortemperatursensor|Kühlmitteltemperatursensor;Temperatursensor Kühlmittel;coolant temperature sensor
Motorlager|Motorhalter;Motor Gummilager;engine mount
Domlager|Federbeinlager;strut mount
Inverter|Wechselrichter;Antriebswechselrichter;inverter
Elektromotor|E Motor;E-Motor;electric motor
Hochvoltbatterie|Hochvolt Batterie;HV Batterie;Traktionsbatterie;Antriebsbatterie;traction battery
Batteriemodul|Batterie Modul;battery module
Batteriemanagementsystem|Batterie Management System;BMS;battery management system
Onboard-Ladegerät|Onboard Charger;Onboard Ladegerät;Bordladegerät;OBC
DC-DC-Wandler|DC DC Wandler;DCDC Wandler;Gleichspannungswandler
Ladebuchse|Ladeanschluss;Ladeport;charging port
Ladekabel|Ladeleitung;charging cable
Batteriekühlung|Batterie Kühlung;battery cooling
Wärmepumpe|Waermepumpe;heat pump
`;
export const partNames=definitions.trim().split("\n").map(line=>line.split("|")[0]);
const entries=definitions.trim().split("\n").map(line=>{
 const [name,aliases=""]=line.split("|");
 return {name,aliases:[...new Set([name,...aliases.split(";")].flatMap(value=>[normal(value),normal(ascii(value))]))]};
});
const explanations={
 Getriebesteuergerät:"Elektronische Steuerung des Getriebes. Die genaue Ausführung hängt vom Getriebetyp ab.",
 Getriebemechatronik:"Steuerungs- und Betätigungseinheit des Getriebes; Umfang und Aufbau unterscheiden sich je nach Bauart.",
 Kupplungsaktuator:"Betätigt die Kupplung in dafür vorgesehenen automatisierten Getrieben.",
 Kupplungsgeberzylinder:"Hydraulischer Geber am Kupplungspedal.",Kupplungsnehmerzylinder:"Hydraulische Betätigung der Kupplung am Getriebe.",
 Motorsteuergerät:"Elektronische Steuerung des Motors.","ABS-Steuergerät":"Elektronische Steuerung des Antiblockiersystems.",
 Bremsbeläge:"Reibbeläge der Scheibenbremse.",Bremsscheiben:"Bremsscheiben am Rad.",Bremssättel:"Bauteile, welche die Bremsbeläge an die Scheibe drücken.",
 Luftfilter:"Filter der Ansaugluft des Motors.",Innenraumfilter:"Filter für die Luft im Fahrzeuginnenraum, auch Pollenfilter genannt.",Kraftstofffilter:"Filter für Benzin oder Diesel.",Ölfilter:"Filter des Motorschmieröls.",
 Batterie:"Starter-/12-Volt-Batterie.",Hochvoltbatterie:"Antriebsbatterie eines dafür ausgelegten Elektro- oder Hybridfahrzeugs."
};
const groups=[
 {aliases:["kupplung steuergerät","kupplungssteuergerät","steuergerät kupplung","kupplung elektronik","kupplung computer","kupplung steuerung","steuerung kupplung","kupplungssteuerung","clutch control unit"],names:["Getriebesteuergerät","Getriebemechatronik","Kupplungsaktuator"],question:"Meinst du die elektronische Getriebesteuerung, die Mechatronik oder die Betätigung der Kupplung?"},
 {aliases:["steuergerät","steuerbox","steuerteil","control unit"],names:["Motorsteuergerät","Getriebesteuergerät","ABS-Steuergerät"],question:"Welches System soll das Steuergerät steuern?"},
 {aliases:["bremsen","bremse"],names:["Bremsbeläge","Bremsscheiben","Bremssättel"],question:"Welches Teil der Bremse suchst du?"},
 {aliases:["filter"],names:["Ölfilter","Luftfilter","Innenraumfilter","Kraftstofffilter"],question:"Welchen Filter meinst du?"},
 {aliases:["kupplung zylinder","kupplungszylinder"],names:["Kupplungsgeberzylinder","Kupplungsnehmerzylinder"],question:"Suchst du den Geber am Pedal oder den Nehmer am Getriebe?"}
].map(group=>({...group,aliases:[...new Set(group.aliases.flatMap(value=>[normal(value),normal(ascii(value))]))]}));
const fillers=new Set("ich was etwas suche such suchen brauche brauch benotige bitte einen eine ein der die das fur mein meine meinen meinem am vom zum ersatzteil ersatzteile kaufen".split(" "));
const positions=new Map(Object.entries({vorne:"vorne",vorn:"vorne",vorderachse:"vorne",front:"vorne",hinten:"hinten",hinterachse:"hinten",rear:"hinten",links:"links",left:"links",rechts:"rechts",right:"rechts",oben:"oben",unten:"unten"}));
const vocabulary=[...new Set([...entries.flatMap(entry=>entry.aliases),...groups.flatMap(group=>group.aliases)].flatMap(alias=>alias.split(" ")).filter(token=>/^[a-z]{4,}$/.test(token)))];
const knownWords=new Set([...vocabulary,...fillers,...positions.keys()]);
function distance(a,b,max=2){
 if(Math.abs(a.length-b.length)>max)return max+1;
 const matrix=Array.from({length:a.length+1},(_,i)=>[i]);for(let j=0;j<=b.length;j++)matrix[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  matrix[i][j]=Math.min(matrix[i-1][j]+1,matrix[i][j-1]+1,matrix[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])matrix[i][j]=Math.min(matrix[i][j],matrix[i-2][j-2]+1);
 }
 return matrix[a.length][b.length];
}
function spelling(token){
 if(!/^[a-z]{4,}$/.test(token)||knownWords.has(token))return token;
 const max=token.length>=7?2:1;let best=max+1,chosen="",tied=false;
 for(const word of vocabulary){const cost=distance(token,word,max);if(cost<best){best=cost;chosen=word;tied=false;}else if(cost===best&&word.replace(/ae/g,"a").replace(/oe/g,"o").replace(/ue/g,"u")!==chosen.replace(/ae/g,"a").replace(/oe/g,"o").replace(/ue/g,"u"))tied=true;}
 return best<=max&&!tied?chosen:token;
}
function tokensFor(input){return [...input.matchAll(/[\p{L}\p{N}]+(?:[._/\-][\p{L}\p{N}]+)*/gu)].flatMap(match=>/\d/.test(match[0])?[match[0]]:match[0].split(/[._/\-]/)).map(raw=>({raw,value:normal(raw)})).filter(token=>!fillers.has(token.value));}
function matching(tokens,aliases){
 const matches=[];
 for(let start=0;start<tokens.length;start++)for(let end=start+1;end<=Math.min(tokens.length,start+5);end++){
  const phrase=tokens.slice(start,end).map(token=>token.value).join(" ");
  if(aliases.some(alias=>alias===phrase||compact(alias)===compact(phrase)))matches.push({start,end,size:compact(phrase).length});
 }
 return matches.sort((a,b)=>b.size-a.size||b.end-b.start-(a.end-a.start));
}
function qualifiers(tokens,excluded){return tokens.filter((_,index)=>!excluded.some(match=>index>=match.start&&index<match.end)).map(token=>positions.get(token.value)||token.raw);}
function choice(name,tail=[]){return {label:name,query:[name,...tail].join(" "),category:name,description:explanations[name]||"Mit deinen Fahrzeugangaben nach diesem Bauteil suchen."};}
function ambiguous(original,tokens,span,group){return {original,query:original,category:"",status:"ambiguous",message:group.question,suggestions:group.names.map(name=>choice(name,qualifiers(tokens,[span]))).filter(item=>item.query.length<=80)};}

export function understandPartQuery(input,{literal=false}={}){
 const original=String(input??"").normalize("NFKC").trim().replace(/\s+/g," ");
 const base={original,query:original,category:"",status:literal?"literal":"unknown",message:"",suggestions:[]};
 if(literal||!original||original.length>80)return base;
 // Pure article/reference numbers and diagnostic codes must remain byte-for-byte intact.
 if(/\d/.test(original)&&!entries.some(entry=>entry.aliases.some(alias=>normal(original).includes(alias)&&alias.length>=4))&&
  original.split(" ").every(token=>/\d/.test(token)||/^[A-Z]{1,4}$/i.test(token)))return {...base,status:"identifier"};
 let tokens=tokensFor(original);const changes=[];
 const protectedSpans=[...entries,...groups].flatMap(entry=>matching(tokens,entry.aliases));
 tokens=tokens.map((token,index)=>{const value=protectedSpans.some(span=>index>=span.start&&index<span.end)?token.value:spelling(token.value);if(value!==token.value)changes.push([token.raw,value]);return {...token,value};});
 const found=entries.map(entry=>({entry,...matching(tokens,entry.aliases)[0]})).filter(match=>Number.isInteger(match.start)).sort((a,b)=>b.size-a.size);
 const bundle=/\b(mit|with)\b/.test(normal(original));
 const longest=bundle?[...found].sort((a,b)=>a.start-b.start||b.size-a.size)[0]:found[0];
 for(const group of groups){const span=matching(tokens,group.aliases)[0];if(span&&(!longest||span.size>=longest.size))return ambiguous(original,tokens,span,group);}
 if(!longest)return base;
 const alternatives=found.filter(match=>match.entry.name!==longest.entry.name&&(match.end<=longest.start||match.start>=longest.end));
 if(alternatives.length&&!bundle){const choices=[longest,...alternatives].slice(0,4);const tail=tokens.filter(token=>positions.has(token.value)).map(token=>positions.get(token.value));return {...base,status:"ambiguous",message:"Du nennst mehrere Bauteile. Wonach möchtest du zuerst suchen?",suggestions:choices.map(match=>choice(match.entry.name,tail))};}
 const tail=qualifiers(tokens,[longest]);
 const query=[longest.entry.name,...tail].join(" ");
 if(query.length>80)return base;
 const units=new Set(["typ","type","mm","cm","kw","ps","ah","kwh","volt","v","a","zoll"]);
 const category=tail.every(value=>positions.has(normal(value))||/\d/.test(value)||/^[A-Z]{1,4}$/.test(value)||tail.some(token=>/\d/.test(token))&&units.has(normal(value)))?longest.entry.name:"";
 const changed=normal(query)!==normal(original);
 return {...base,query,category,recognized:longest.entry.name,status:changed?"corrected":"exact",message:changed?`Wir suchen nach „${query}“.`:"",corrections:changes};
}

export function suggestPartQueries(input,limit=5){
 const understanding=understandPartQuery(input);
 if(understanding.status==="ambiguous")return understanding.suggestions.slice(0,limit);
 if(understanding.status==="corrected")return [{label:understanding.query,query:understanding.query,category:understanding.category,description:explanations[understanding.recognized]||"Mit diesem Begriff weitersuchen."}];
 const needle=compact(input);if(needle.length<3||/\d/.test(needle))return [];
 return entries.filter(entry=>entry.aliases.some(alias=>compact(alias).startsWith(needle))).slice(0,limit).map(entry=>choice(entry.name));
}

export function partAliases(name){return entries.find(entry=>normal(entry.name)===normal(name))?.aliases||[];}
