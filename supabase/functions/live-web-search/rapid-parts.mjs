import {JsonBodyError, readJson} from "../_shared/read-json.mjs";
import {hasPartNumber, seriesEvidence, words} from "./vehicle-fitment.mjs";

const host = "auto-parts-finder1.p.rapidapi.com";
const endpoint = "https://" + host + "/get_parts";

const categories = {
  bremsbelage: ["brake pads", "brake pad", "bremsbelag", "bremsklotze"],
  bremsscheiben: ["brake discs", "brake disc", "brake rotor", "brake rotors", "bremsscheibe", "disc"],
  olfilter: ["oil filter", "oil filters", "oelfilter", "oilfilter"],
  kraftstofffilter: ["fuel filter", "fuel filters", "diesel filter", "dieselfilter"],
  luftfilter: ["air filter", "air filters", "motorluftfilter"],
  innenraumfilter: ["cabin filter", "cabin filters", "pollen filter", "pollenfilter"],
  zundkerzen: ["spark plugs", "spark plug", "zundkerze"],
  gluhkerzen: ["glow plugs", "glow plug", "gluhkerze"],
  stossdampfer: ["shock absorbers", "shock absorber", "amortisseur"],
  wasserpumpe: ["water pump", "water pumps"],
  radlager: ["wheel bearing", "wheel bearings"],
  scheibenwischer: ["wiper blades", "wiper blade", "windshield wipers"]
};

const positions = [
  ["front", /\b(vorn|vorne|vorderachse|front)\b/],
  ["rear", /\b(hinten|hinterachse|rear)\b/],
  ["left", /\b(links|left)\b/],
  ["right", /\b(rechts|right)\b/]
];
const knownSources = new Set([
  "mister-auto.com", "www.mister-auto.com", "mister-auto.de", "www.mister-auto.de",
  "auto-doc.fr", "www.auto-doc.fr",
  "rockauto.com", "www.rockauto.com", "www.autodoc.de", "www.atp-autoteile.de",
  "www.motointegrator.de", "www.kfzteile24.de", "www.daparto.de",
  "levoil.de", "shop.autoersatzteile-frankfurt.de"
]);

export function rapidQuery(vehicle, term, category) {
  const type = categories[words(category)]?.[0];
  if (!type || !vehicle.engine || !vehicle.series) return null;
  const requested = words(term);
  const sides = positions.filter(([, regex]) => regex.test(requested)).map(([name]) => name);
  const engineFamily = vehicle.engine.match(/\b\d[.,]\d\s+(?:TDI|TSI|TFSI|TDCI|dCi|CRDi|EcoBoost|PureTech|TCe)\b/i);
  return {
    model: vehicle.model,
    engine: engineFamily?.[0] || vehicle.engine,
    year: String(vehicle.year),
    category: [...sides, type].join(" ")
  };
}

function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 600) return null;
  try {
    const hostOrUrl = value.trim();
    const url = new URL(knownSources.has(hostOrUrl.toLowerCase()) ? "https://" + hostOrUrl : hostOrUrl);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      knownSources.has(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function hasWords(haystack, needle) {
  return (" " + haystack + " ").includes(" " + needle + " ");
}

export function rapidReferences(data, category, term) {
  const rows = Array.isArray(data) ? data : data?.compatible_parts ?? data?.parts ?? data?.results ?? data?.data;
  if (!Array.isArray(rows)) throw new Error("Unexpected Auto Parts Finder response");
  const typeKey = words(category);
  const names = (categories[typeKey] || []).concat(typeKey);
  const requested = words(term);
  const opposing = [[positions[0], positions[1]], [positions[1], positions[0]],
    [positions[2], positions[3]], [positions[3], positions[2]]];
  const parts = new Map();
  for (const row of rows.slice(0, 60)) {
    if (typeof row?.ref !== "string" || !row.ref.trim() || typeof row?.type !== "string") continue;
    const description = words([row.type, row.position].join(" "));
    if (!names.some(name => name && hasWords(description, name))) continue;
    if (opposing.some(([[, side], [, opposite]]) =>
      side.test(requested) && opposite.test(description) && !side.test(description))) continue;

    const reference = row.ref.trim().slice(0, 120);
    if (parts.has(words(reference))) continue;
    const amount = String(row.price ?? "").trim();
    const price = /^\d{1,7}(?:[.,]\d{1,2})?$/.test(amount) && Number(amount.replace(",", ".")) > 0
      ? Number(amount.replace(",", ".")) : null;
    parts.set(words(reference), {
      reference,
      type: row.type.trim().slice(0, 100),
      price,
      currency: typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) ? row.currency : null,
      url: httpsUrl(row.url || row.source)?.href || "",
      image: httpsUrl(row.image_url || row.image)?.href || ""
    });
    if (parts.size === 8) break;
  }
  return [...parts.values()];
}

export function rapidPartsForVehicle(parts, vehicle, category, applications) {
  const brakes = ["bremsbelage", "bremsscheiben"].includes(words(category));
  return parts.filter(part => {
    if (seriesEvidence(vehicle, part.reference + " " + part.type) === "conflict") return false;
    // Provider records alone do not establish a brake part's axle or vehicle application.
    return !brakes || applications.some(application => application.match === "exact" &&
      hasPartNumber(part.reference, application.manufacturer_part_number));
  });
}

export async function lookupRapidParts(query, category, term, key, request = (url, options) => fetch(url, options)) {
  let http;
  try {
    const response = await request(endpoint, {
      method: "POST",
      headers: {"Content-Type": "application/json", "Accept": "application/json", "x-rapidapi-host": host, "x-rapidapi-key": key},
      body: JSON.stringify(query),
      redirect: "manual",
      signal: AbortSignal.timeout(32000)
    });
    http = response.status;
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      return {status: http === 429 ? "quota" : http === 401 || http === 403 ? "access" : "unavailable", parts: [], http};
    }
    const data = await readJson(response, 180000, {requireContentType: false});
    if (typeof data?.message === "string" &&
        /not subscribed to this api|invalid api key/i.test(data.message)) {
      return {status: "access", parts: [], http};
    }
    const parts = rapidReferences(data, category, term);
    return {status: parts.length ? "ready" : "empty", parts};
  } catch (error) {
    const message = String(error?.message ?? "");
    const reason = error instanceof JsonBodyError ? "response_json_" + error.status
      : http ? "invalid_response"
      : /dns|network|connect|certificate/i.test(message) ? "network"
      : error?.name === "TimeoutError" ? "timeout"
      : /invalid header/i.test(message) ? "invalid_header" : "transport";
    return {status: "unavailable", parts: [], http, reason};
  }
}
