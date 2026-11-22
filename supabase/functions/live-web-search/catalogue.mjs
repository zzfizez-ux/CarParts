import {engineInSeries, engineMatch, matchesPart, seriesKey} from "./vehicle-fitment.mjs";

export async function catalogueEngines(read, vehicle) {
  const rows = await read("car_engines", {
    select:"id,designation,engine_code,year_from,year_to,series_keys,car_models!inner(name,car_brands!inner(name))",
    "car_models.name":"eq."+vehicle.model,
    "car_models.car_brands.name":"eq."+vehicle.make,
    and:"(or(year_from.is.null,year_from.lte."+vehicle.year+"),or(year_to.is.null,year_to.gte."+vehicle.year+"))",
    order:"designation.asc",
    limit:"250"
  });
  return rows.filter(row => engineInSeries(vehicle, row));
}

export async function catalogueParts(read, engines, vehicle, term, category, allowConditional = false) {
  const selected = new Map(engines.map(row => [row.id, {...row, match:engineMatch(vehicle,row)}])
    .filter(([,row]) => row.match==="exact" || (allowConditional && row.match==="conditional")));
  if (!selected.size) return [];
  const key = seriesKey(vehicle.make,vehicle.model,vehicle.series);
  const filters = {
    select:"id,engine_id,notes,source_url,year_from,year_to,series_keys,parts!inner(id,manufacturer,part_name,manufacturer_part_number,category,source_url,oe_numbers(oe_number))",
    engine_id:"in.("+[...selected.keys()].join(",")+")",
    "parts.verification_status":"eq.verified",
    status:"eq.verified",
    order:"id.asc",
    limit:"100",
    and:"(or(year_from.is.null,year_from.lte."+vehicle.year+"),or(year_to.is.null,year_to.gte."+vehicle.year+"))"
  };
  if (category && !/\d/.test(term)) filters["parts.category"] = "eq."+category;

  const matches = [];
  for (;;) {
    const applications = await read("part_fitments", filters);
    for (const {parts:part,...fitment} of applications) {
      if (fitment.series_keys && !fitment.series_keys.includes(key)) continue;
      if ((fitment.year_from && vehicle.year < fitment.year_from) || (fitment.year_to && vehicle.year > fitment.year_to)) continue;
      const engine = selected.get(fitment.engine_id);
      const row = {
        ...part, oe:(part.oe_numbers||[]).map(ref=>ref.oe_number), fitment,
        engine:engine.designation, engine_code:engine.engine_code, match:engine.match
      };
      if (!term || matchesPart(row,term,category)) matches.push(row);
    }
    if (applications.length < Number(filters.limit)) return matches;
    filters.id = "gt."+applications.at(-1).id;
  }
}
