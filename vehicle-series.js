import {catalogueSeriesNames, seriesKey as keyForSeries} from "./supabase/functions/live-web-search/vehicle-fitment.mjs?v=37";

const $=id=>document.getElementById(id);

export function years(start,end){
 const currentYear=new Date().getFullYear();
 const newest=Math.min(end||currentYear,currentYear);
 const oldest=start||1900;
 $("year").replaceChildren(new Option("Baujahr wählen / Select year",""),
  ...Array.from({length:Math.max(0,newest-oldest+1)},(_,i)=>new Option(newest-i,newest-i)));
}

// Common chassis codes are available immediately, including when the source is offline.
const localSeries = {
  "Borgward": {"Isabella": "Isabella:1954-1962"},
  "DKW": {"F12": "F12:1963-1965"},
  "Isdera": {"Imperator 108i": "Imperator 108i:1984-1995"},
  "MAN": {"TGE": "TGE Kasten:2017-"},
  "Maybach": {"57": "W240:2002-2012", "62": "V240:2002-2012"},
  "NSU": {"Ro 80": "Ro 80:1967-1977"},
  "Trabant": {"601": "601:1964-1990", "1.1": "1.1:1990-1991"},
  "Wartburg": {"1.3": "1.3:1988-1991"},
  "Wiesmann": {"Roadster": "MF3:1993-2014"},
  "Mercedes-Benz": {
    "S-Klasse": "W116:1972-1980,W126:1979-1991,W140:1991-1998,V140:1991-1998,W220:1998-2005,W221:2005-2013,W222:2013-2020,W223:2020-",
    "E-Klasse": "W124:1993-1995,W210:1995-2002,W211:2002-2009,W212:2009-2016,W213:2016-2023,W214:2023-",
    "C-Klasse": "W202:1993-2000,W203:2000-2007,W204:2007-2014,W205:2014-2021,W206:2021-",
    "A-Klasse": "W168:1997-2004,W169:2004-2012,W176:2012-2018,W177:2018-",
    "B-Klasse": "W245:2005-2011,W246:2011-2018,W247:2018-",
    "SL": "R107:1971-1989,R129:1989-2001,R230:2001-2011,R231:2012-2020,R232:2021-",
    "SLK": "R170:1996-2004,R171:2004-2011,R172:2011-2016"
  },
  "BMW": {
    "3er": "E21:1975-1983,E30:1982-1994,E36:1990-2000,E46:1998-2006,E90:2005-2011,E91:2005-2012,E92:2006-2013,E93:2007-2013,F30:2011-2019,F31:2012-2019,G20:2018-,G21:2019-",
    "5er": "E12:1972-1981,E28:1981-1988,E34:1987-1996,E39:1995-2004,E60:2003-2010,E61:2004-2010,F10:2010-2017,F11:2010-2017,G30:2016-2023,G31:2017-2024,G60:2023-,G61:2024-",
    "7er": "E23:1977-1986,E32:1986-1994,E38:1994-2001,E65:2001-2008,F01:2008-2015,G11:2015-2022,G70:2022-"
  },
  "Volkswagen": {
    "Golf": "Golf I:1974-1983,Golf II:1983-1992,Golf III:1991-1997,Golf IV:1997-2003,Golf V:2003-2008,Golf VI:2008-2012,Golf VII:2012-2020,Golf VIII:2019-"
  }
};
const sourceIndex = window.CarPartsModelIndex;
const bundledGroups = new Set(['cupra', 'dacia', 'jaguar', 'jeep', 'land-rover', 'lexus', 'mini', 'saab', 'smart', 'tesla']);
const seriesCache = new Map();
const sourceVersion = 'ad1d97654d7ac50b393bfeafad3b8b21f5f15657';
export function displayModel(make, name) {
  if (make === 'Mercedes-Benz') return name.replace(/^MERCEDES BENZ /i,'').replace(/-Class\b/g,'-Klasse').replace(/ and predecessors$/,'');
  if (make === 'BMW') return name.replace(/^(\d) Series\b/,'$1er');
  return name;
}
export function knownSeries(make, model) {
  const rows = localSeries[make]?.[model];
  return rows ? rows.split(',').map(record => {
    const [name, range] = record.split(':');
    const [start, end] = range.split('-').map(Number);
    return {name, start, end};
  }) : [];
}
// W140 sales designations changed in 1993. Restrict suggestions by production year.
export function seriesEngines(make, model, code, year) {
  if (make === 'Mercedes-Benz' && model === 'S-Klasse' && code === 'W140') {
    const designations = [
      ['300 SE',1991,1993],['400 SE',1991,1993],['500 SE',1991,1993],['600 SE',1991,1993],
      ['300 SE 2.8',1992,1993],['S 280',1993,1998],['S 320',1993,1998],
      ['S 420',1993,1998],['S 500',1993,1998],['S 600',1993,1998],
      ['S 350 Turbodiesel',1993,1996],['S 300 Turbodiesel',1996,1998]
    ];
    return designations.filter(([,from,to])=>!year || (year>=from && year<=to)).map(([name])=>name);
  }
  return seriesRows.find(row=>row.name===code)?.engines;
}
function loadBrandSeries(make) {
  const entry = sourceIndex[make];
  if (!entry) return Promise.resolve([]);
  if (!seriesCache.has(entry.group)) {
    const url = bundledGroups.has(entry.group) ? 'data/series/'+entry.group+'.json' : 'https://cdn.jsdelivr.net/gh/gor3a/vehicle-makes-models@'+sourceVersion+'/data/json/'+encodeURIComponent(entry.group)+'.json';
    const pending = fetch(url, {signal:AbortSignal.timeout(16000)}).then(async response => {
      if (!response.ok) throw Error('Generation data unavailable');
      return (await response.json()).makes;
    }).catch(error => {seriesCache.delete(entry.group); throw error});
    seriesCache.set(entry.group, pending);
  }
  return seriesCache.get(entry.group);
}

let seriesRows = [];
let seriesRequest = 0;
export function availableSeries() {
  return seriesRows.map(row=>row.name);
}
export function selectedSeries() {
  return $('series').value === '__other' ? $('customSeries').value.trim() : $('series').value;
}
function paintSeries(preferred, pending) {
  const select = $('series');
  const make = $('make').value;
  const model = $('model').value;
  const options = [new Option(!model ? 'Zuerst Modell wählen / Select model first' :
    pending ? 'Baureihen werden geladen / Loading series…' : 'Baureihe wählen / Select series', '')];
  for (const row of seriesRows) {
    const range = row.start ? ' · '+row.start+'–'+(row.end || '…') : '';
    const chassis = catalogueSeriesNames(make,model).find(name =>
      keyForSeries(make,model,name) === keyForSeries(make,model,row.name));
    const chassisLabel = make === 'Volkswagen' && model === 'Polo' ?
      ({'Polo IV':'Polo IV · 9N','Polo V':'Polo V · 6R/6C','Polo VI':'Polo VI · AW'}[chassis] || chassis) : chassis;
    const code = chassisLabel && chassisLabel !== row.name ? ' · '+chassisLabel : '';
    options.push(new Option(row.name+code+({W140:" · Limousine",V140:" · Langversion"}[row.name] || "")+range, row.name));
  }
  if (model) options.push(new Option('Andere Baureihe eingeben / Enter series manually', '__other'));
  select.replaceChildren(...options);
  select.disabled = !model;
  if (preferred && seriesRows.some(row => row.name === preferred)) select.value = preferred;
  else if (preferred && model) {
    select.value = '__other';
    $('customSeries').value = preferred;
  }
  $('customSeries').hidden = select.value !== '__other';
}
export function updateSeriesYears(preferredYear) {
  const selected = seriesRows.find(row => row.name === $('series').value);
  years(selected?.start, selected?.end);
  $('year').value = preferredYear || '';
}
export async function loadSeries(preferred = '', preferredYear = '') {
  const make = $('make').value, model = $('model').value;
  const request = ++seriesRequest;
  const local = knownSeries(make, model);
  const supplemental = catalogueSeriesNames(make,model)
    .filter(name=>!local.some(row=>row.name===name))
    .map(name=>({name,start:null,end:null}));
  // Existing selections with curated ranges retain those ranges.
  seriesRows = local.length ? local : supplemental;
  $('customSeries').value = '';
  const lookup = !!model && !local.length && !!sourceIndex[make];
  paintSeries(preferred, lookup);
  updateSeriesYears(preferredYear);
  if (!lookup) return;
  try {
    const makes = await loadBrandSeries(make);
    if (request !== seriesRequest) return;
    const brand = makes.find(item => item.name.toLowerCase() === make.toLowerCase());
    const models = (brand?.models || []).filter(item => displayModel(make,item.name).toLowerCase() === model.toLowerCase());
    const generations = models.flatMap(item => item.generations || []);
    const rows = generations.filter(row => row.name).map(row => ({
      name:row.name, start:row.yearStart, end:row.yearEnd,
      engines:(row.engines || []).map(engine => engine.label).filter(Boolean)
    }));
    const known = new Set(rows.map(row=>keyForSeries(make,model,row.name)));
    seriesRows = [...new Map(rows.map(row=>[row.name,row])).values(),
      ...supplemental.filter(row=>!known.has(keyForSeries(make,model,row.name)))];
  } catch { /* Manual entry remains available offline. */ }
  if (request !== seriesRequest) return;
  const chosen = selectedSeries(), manual = $('series').value === '__other';
  const year = $('year').value;
  paintSeries(chosen, false);
  if (manual && !chosen) { $('series').value = '__other'; $('customSeries').hidden = false; }
  updateSeriesYears(year);
  if(chosen&&!preferred) $("series").dispatchEvent(new Event("seriesloaded"));
}

