export function words(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, " ").trim();
}

export function partNumber(value) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const catalogueSeries = {
  "audi/a1": {"8X":["A1 (2010)","A1 (2014)"], "GB":["A1 (2018)","A1 (2022)"]},
  "audi/a3": {"8V":[]},
  "audi/a4": {"B8 Avant":["A4 Avant (2008)","A4 Avant (2012)"]},
  "audi/a6": {"C7 Limousine":["A6 (2011)","A6 (2014)"]},
  "audi/q5": {"8R":["Q5 (2008)","Q5 (2012)","Q5 (2016)","8RB"]},
  "alpina/d3": {"F30":[],"F31":[]},
  "bmw/3er": {"F30":["3 Series Sedan (2011)","3 Series Sedan (2015)"], "F31":["3 Series Touring (2012)","3 Series Touring (2015)"]},
  "bmw/1er": {"F20":["1 Series (2011)","1 Series (2015)","1 Series (2017)"], "F21":["1 Series 3 doors (2012)","1 Series 3 doors (2015)","1 Series 3 doors (2017)"]},
  "bmw/x3": {"F25":["X3 (2010)","X3 (2014)"]},
  "bmw/x5": {"E70":["X5 (2007)","X5 (2010)"]},
  "bmw/i3": {"I01":["i3 (2013)","i3 (2017)"]},
  "dacia/logan": {
    "Logan I":["Logan (2004)","Logan (2008)","Logan I (LS)"],
    "Logan II":["Logan (2012)","Logan (2016)","Logan MCV II"],
    "Logan III":["Logan (2020)"]
  },
  "ford/focus": {"Focus II":["Focus Mk2"], "Focus III":["Focus Mk3","Focus (2010)","Focus (2014)","Focus (2011)"], "Focus IV":["Focus Mk4","Focus (2018)","Focus (2021)"]},
  "hyundai/i30": {"FD":["i30 (2007)"], "GD":["i30 (2012)","i30 (2015)"], "PD":["i30 (2016)","i30 (2017)","i30 (2020)","i30 (2024)"]},
  "mazda/3": {"BK":["3 (2003)"], "BL":["3 (2009)","3 (2011)"], "BM":["3 (2013)","3 (2016)"], "BP":["3 (2018)","3 (2019)"]},
  "mercedes/glc": {"X253":["GLC (2015)","GLC (2019)"], "X254":["GLC (2022)"]},
  "mercedes/s klasse": {
    "W116":[], "W126":[], "W140":[], "V140":[], "W220":[], "V220":[], "W221":[], "V221":[],
    "W222":["S-Class (2017)"], "V222":[], "X222":[], "C217":[], "A217":[], "W223":[], "V223":[]
  },
  "nissan/qashqai": {"J10":["Qashqai I","Qashqai (2007)","Qashqai (2010)"], "J11":["Qashqai II","Qashqai (2013)","Qashqai (2014)","Qashqai (2017)"], "J12":["Qashqai III","Qashqai (2021)","Qashqai (2024)"]},
  "opel/corsa": {"Corsa D":["Corsa (2006)","Corsa (2011)"], "Corsa E":["Corsa (2014)","Corsa (2015)"], "Corsa F":["Corsa (2019)","Corsa (2023)"]},
  "opel/astra": {"Astra K":[]},
  "opel/mokka": {"Mokka A":["Mokka (2012)"]},
  "opel/insignia": {"Insignia A Schrägheck":[]},
  "porsche/911": {"997.1":[], "997.2":[], "991.1":[]},
  "porsche/macan": {"95B":["Macan (2014)"]},
  "porsche/cayenne": {"92A":["Cayenne (2010)","Cayenne (2014)"]},
  "mini/cooper": {"R56":[]},
  "smart/fortwo": {"451 Coupé":[], "451 Cabrio":[]},
  "smart/forfour": {"453":["forfour (2014)","forfour (2019)"]},
  "renault/clio": {"Clio III":["Clio 3","Clio (2005)","Clio (2009)"], "Clio IV":["Clio 4","Clio (2012)","Clio (2016)"], "Clio V":["Clio 5","Clio (2019)","Clio (2023)"]},
  "toyota/yaris": {"Yaris II":["XP90"], "Yaris III":["Yaris 3","XP130","Yaris (2011)","Yaris (2014)","Yaris (2017)"], "Yaris IV":["XP210","Yaris (2020)"]},
  "volkswagen/golf": {
    "Golf I":["Golf 1","Golf Mk1"], "Golf II":["Golf 2","Golf Mk2"], "Golf III":["Golf 3","Golf Mk3"],
    "Golf IV":["Golf 4","Golf Mk4"], "Golf V":["Golf 5","Golf Mk5"],
    "Golf VI":["Golf 6","Golf Mk6","5K1"], "Golf VII":["Golf 7","Golf Mk7","5G1","BA5","BQ1","BE1","BE2"],
    "Golf VIII":["Golf 8","Golf Mk8","CD1"]
  },
  "volkswagen/polo": {
    "Polo IV":["Polo 4","9N","Polo 5 Doors (2001)","Polo 5 Doors (2004)","Polo 5 Doors (2005)","Polo 5 Doors (2006)","Polo 3 Doors (2001)","Polo 3 Doors (2005)"],
    "Polo V":["Polo 5","6R","6C","6R1","6C1","Polo (2009)","Polo (2014)","Polo 5 Doors (2009)","Polo 5 Doors (2010)","Polo 5 Doors (2014)","Polo 3 Doors (2009)","Polo 3 Doors (2014)"],
    "Polo VI":["Polo 6","AW1","Polo (2017)","Polo (2021)","Polo 5 Doors (2017)","Polo 5 Doors (2021)"]
  },
  "volkswagen/passat": {"B8":["Passat (2014)","Passat (2019)","Passat Variant (2014)","Passat Variant (2019)"]},
  "volkswagen/tiguan": {"Tiguan I":["Tiguan 1","5N","Tiguan (2007)","Tiguan (2011)"], "Tiguan II":["Tiguan 2","AD1","AX1","Tiguan (2016)","Tiguan (2020)"]},
  "volkswagen/touran": {"1T1":["Touran (2003)"], "1T2":["Touran (2006)"], "1T3":["Touran (2010)"], "5T":["Touran (2015)","5T1"]}
};

function seriesMap(make, model) {
  const brand = words(make).replace(/^mercedes (benz|amg)$/, "mercedes");
  const modelName = brand === "mercedes" ? words(model).replace(/ class$/, " klasse") : words(model);
  return catalogueSeries[brand + "/" + modelName] ?? {};
}

function seriesWords(value) {
  return words(value).replace(/\b([a-z]{1,2}) (\d{2,3})\b/g, (all, prefix, digits) =>
    /^[wvcaxefgjr]$/.test(prefix) || /^[wx]$/.test(prefix[0]) ? prefix + digits : all);
}

export function seriesKey(make, model, series) {
  const name = seriesWords(series);
  for (const [key, aliases] of Object.entries(seriesMap(make, model))) {
    if ([key, ...aliases].some(alias => seriesWords(alias) === name)) return words(key);
  }
  return name;
}

export function catalogueSeriesNames(make, model) {
  return Object.keys(seriesMap(make, model));
}

function phraseIn(haystack, needle) {
  return Boolean(needle) && (" " + haystack + " ").includes(" " + needle + " ");
}

// Only explicit evidence can confirm or contradict a selected generation.
export function seriesEvidence(vehicle, text, otherSeries = []) {
  const {make, model, series} = vehicle;
  if (!series) return "unknown";
  const selected = seriesKey(make, model, series);
  const description = seriesWords(text);
  if (selected.length >= 2 && phraseIn(description, selected)) return "match";
  const groups = seriesMap(make, model);
  const rules = Object.entries(groups).flatMap(([name, aliases]) =>
    [name, ...aliases].map(alias => [seriesWords(alias), words(name)]));
  // Remote catalog generations contribute their real labels as well.
  for (const label of [series, ...otherSeries]) {
    const name = seriesWords(label);
    if (name.length >= 3 && name !== words(model)) rules.push([name, seriesKey(make, model, label)]);
  }
  const matches = rules.filter(([name]) => phraseIn(description, name)).map(([,key]) => key);
  if (matches.includes(selected)) return "match";
  if (matches.length) return "conflict";
  // Explicit manufacturer platform codes also work for models outside the reviewed catalog.
  const brand=words(make);
  const pattern=/^mercedes/.test(brand) ? /\b[wvxcars]\d{3}\b/g
    : brand==="bmw" ? /\b[efg]\d{2}\b/g : null;
  if (pattern && (selected.match(pattern)||[]).length && (description.match(pattern)||[]).length) return "conflict";
  return "unknown";
}

export function engineMatch(vehicle, row) {
  const selected = words(vehicle.engine);
  if (!selected) return "unknown";
  if (selected === words(row.designation)) return "exact";
  if (row.engine_code && partNumber(selected) === partNumber(row.engine_code)) return "conditional";
  const family = selected.match(/^\d \d (?:tdi|tsi|tfsi|tdci|dci|crdi|ecoboost)(?: \d{2,3} ps)?$/);
  if (family && phraseIn(words(row.designation), selected)) return "conditional";
  return "conflict";
}

export function engineInSeries(vehicle, row) {
  return row.series_keys?.includes(seriesKey(vehicle.make, vehicle.model, vehicle.series)) === true;
}

export function hasPartNumber(text, number) {
  const value = partNumber(number);
  if (value.length < 4 || !/\d/.test(value)) return false;
  const pattern = value.split("").join("[\\s./_–-]*");
  return new RegExp("\\b" + pattern + "\\b", "i").test(String(text ?? ""));
}

const categories = {
  "bremsbelage":["bremsbelage","bremsbelag","bremsklotze","brake pads","brake pad"],
  "bremsscheiben":["bremsscheiben","bremsscheibe","brake discs","brake disc","brake rotors","brake rotor"],
  "bremssattel":["bremssattel","bremssatteln","bremszange","bremszangen","brake caliper","brake calipers"],
  "bremsschlauch":["bremsschlauch","bremsschlauche","brake hose","brake hoses"],
  "querlenker":["querlenker","achslenker","lenker","wishbone","control arm"],
  "traggelenk":["traggelenk","traggelenke","fuhrungsgelenk","ball joint"],
  "koppelstange":["koppelstange","koppelstangen","stabilisatorstrebe","stabilizer link"],
  "axialgelenk":["axialgelenk","inneres spurstangengelenk","inner tie rod"],
  "spurstangenkopf":["spurstangenkopf","spurstangenkopfe","spurkopf","tie rod end"],
  "hauptbremszylinder":["hauptbremszylinder","brake master cylinder"],
  "radbremszylinder":["radbremszylinder","wheel brake cylinder","brake wheel cylinder"],
  "bremstrommeln":["bremstrommeln","bremstrommel","brake drum","brake drums"],
  "bremsbacken":["bremsbacken","bremsbacke","brake shoes","brake shoe"],
  "bremsbackensatz":["bremsbackensatz","bremsbacken satz","brake shoe kit"],
  "kupplungsgeberzylinder":["kupplungsgeberzylinder","kupplungsgeber","geberzylinder","clutch master cylinder"],
  "kupplungsnehmerzylinder":["kupplungsnehmerzylinder","kupplungsnehmer","nehmerzylinder","clutch slave cylinder"],
  "zentralausrucker":["zentralausrucker","ausrucklager","central clutch release device"],
  "bremsbelagverschleisssensor":["bremsbelagverschleisssensor","bremsbelag warnkontakt","warnkontakt","brake pad wear sensor"],
  "olfilter":["olfilter","oelfilter","motorolfilter","oil filter","oilfilter"],
  "kraftstofffilter":["kraftstofffilter","dieselfilter","spritfilter","fuel filter"],
  "luftfilter":["luftfilter","motorluftfilter","air filter"],
  "innenraumfilter":["innenraumfilter","pollenfilter","cabin filter"],
  "zundkerzen":["zundkerzen","zundkerze","spark plugs","spark plug"],
  "gluhkerzen":["gluhkerzen","gluhkerze","glow plugs","glow plug"],
  "stossdampfer":["stossdampfer","shock absorber"],
  "keilrippenriemen":["keilrippenriemen","keilrippenriemensatz","multi v belt","multi v belt kit"],
  "scheibenwischer":["scheibenwischer","windshield wipers","wiper blades"]
};

export function matchesPosition(term, ...labels) {
  const wanted = words(term);
  const found = words(labels.join(" "));
  for (const synonyms of [
    /\b(vorn|vorne|vorder|vorderachse|front)\b/, /\b(hinten|hinter|hinterachse|rear)\b/,
    /\b(links|left)\b/, /\b(rechts|right)\b/, /\b(oben|upper)\b/, /\b(unten|lower)\b/
  ]) {
    if (synonyms.test(wanted) && !synonyms.test(found)) return false;
  }
  return true;
}

export function matchesPartText(text, term, category = "") {
  const description = words(text);
  const aliases = categories[words(category)] || categories[words(term)] || [];
  const tokens=words(term).split(" ").filter(token=>!(/^(vorne|vorn|vorderachse|front|hinten|hinterachse|rear|links|left|rechts|right|oben|unten)$/.test(token)));
  const unordered=tokens.length>0 && tokens.every(token=>phraseIn(description,token));
  return matchesPosition(term, text) && (
    unordered ||
    phraseIn(description, words(term)) || aliases.some(alias => phraseIn(description, alias)) ||
    (/\d/.test(term) && hasPartNumber(text, term))
  );
}

export function matchesPart(row, term, category = "") {
  const equipment = words(term).match(/\b(pr|rpo|poc)(?: code| nummer)? ([a-z0-9]{3})\b/);
  if (equipment) {
    const notes = String(row.fitment?.notes ?? "");
    const applicable = notes.match(new RegExp("\\b" + equipment[1] + "-Codes?: ([A-Z0-9, ]+)\\.", "i"));
    if (!applicable || !words(applicable[1]).split(" ").includes(equipment[2])) return false;
  }
  const key = partNumber(term);
  if (key.length >= 4 && /\d/.test(key) &&
      [row.manufacturer_part_number, ...(row.oe || [])].some(number => partNumber(number) === key)) return true;
  return matchesPartText([row.part_name, row.category, row.manufacturer].join(" "), term, category) &&
    matchesPosition(term, row.part_name);
}
