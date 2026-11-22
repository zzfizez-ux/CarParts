import {engineInSeries, engineMatch, matchesPart} from "./vehicle-fitment.mjs";

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
  const selected = engines.map(row => ({...row, match:engineMatch(vehicle,row)}))
    .filter(row => row.match==="exact" || (allowConditional && row.match==="conditional"));
  if (!selected.length) return [];
  const applications = await read("part_fitments", {
    select:"engine_id,notes,source_url,parts!inner(id,manufacturer,part_name,manufacturer_part_number,category,source_url,oe_numbers(oe_number))",
    engine_id:"in.("+selected.map(row=>row.id).join(",")+")",
    "parts.verification_status":"eq.verified",
    status:"eq.verified",
    order:"part_id.asc",
    limit:"100"
  });
  const parts = applications.map(({parts:part,...fitment}) => {
    const engine = selected.find(row=>row.id===fitment.engine_id);
    return {
      ...part, oe:(part.oe_numbers||[]).map(ref=>ref.oe_number), fitment,
      engine:engine.designation, engine_code:engine.engine_code, match:engine.match
    };
  }).filter(part => matchesPart(part,term,category));
  return parts;
}
