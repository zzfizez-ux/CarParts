// CarParts on-demand discovery: source is the immutable, CC0-licensed OilSpec snapshot.
// This endpoint receives make/model/year only. Never send or store VINs, IPs or raw user text.
// No arbitrary URLs, scraping of marketplaces, prices, or unverified "fits" claims.
import {siteRequest} from "../_shared/site-config.mjs";

const PROJECT = "umhzxsryqhwzxrmkbmwp";
const SUPABASE = "https://" + PROJECT + ".supabase.co";
const SNAPSHOT = "https://raw.githubusercontent.com/zzfizez-ux/CarParts/494de293e3ecec51d72741c0b6087b53c90e9ef5/open-oilfilters-data.js";
const SOURCE = "https://github.com/carbonautorepair/oilspec-commons";
const MAX_ROWS = 40;
const DAY_BUDGET = 120;
function publicKeys(): string[] {
  try {
    const value = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    return Object.values(value).filter((v): v is string => typeof v === "string");
  } catch { return []; }
}
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (typeof keys.default === "string") return keys.default;
  } catch { /* legacy below */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
async function db(table: string, method: "GET" | "POST", params: Record<string, string>, body?: unknown) {
  const url = new URL(SUPABASE + "/rest/v1/" + table);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const key = secretKey();
  if (!key) throw new Error("Supabase server secret unavailable");
  const res = await fetch(url, {
    method,
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(6500),
  });
  if (!res.ok) throw new Error("Supabase " + table + " " + res.status);
  return await res.json();
}
const safeName = (s: unknown): s is string =>
  typeof s === "string" && s.length >= 1 && s.length <= 70 && /^[\p{L}\p{N} .&'/-]+$/u.test(s);
const rowsToClient = (records: any[]) => records.map((r: any) => [
  r.make, r.model, r.model_year, r.source_vehicle, r.source_engine, r.part_references,
]);
async function cached(make: string, model: string, year: number) {
  const filter = { make: "eq." + make, model: "eq." + model, model_year: "eq." + year };
  const [queries, rows] = await Promise.all([
    db("open_oilfilter_search_cache", "GET", { select: "checked_at,result_count", ...filter, limit: "1" }),
    db("open_oilfilter_cache", "GET", {
      select: "make,model,model_year,source_vehicle,source_engine,part_references",
      ...filter, order: "source_row_index.asc", limit: String(MAX_ROWS),
    }),
  ]);
  const recent = queries[0] && Date.now() - Date.parse(queries[0].checked_at) < 7 * 86400000;
  return { recent, rows: rowsToClient(rows), count: rows.length };
}
async function sourceRows(make: string, model: string, year: number) {
  const response = await fetch(SNAPSHOT, {
    headers: { Accept: "text/plain" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok || Number(response.headers.get("content-length") || 0) > 900000)
    throw new Error("CC0 snapshot unavailable");
  const raw = await response.text();
  if (raw.length > 900000) throw new Error("CC0 snapshot too large");
  const prefix = "window.CARPARTS_OPEN_OILFILTERS=";
  if (!raw.startsWith("// Derived from OilSpec Commons") || !raw.includes(prefix))
    throw new Error("Unexpected CC0 snapshot format");
  const parsed = JSON.parse(raw.slice(raw.indexOf(prefix) + prefix.length).trim().replace(/;\s*$/, ""));
  if (parsed.license !== "CC0-1.0" || parsed.source !== SOURCE || !Array.isArray(parsed.rows))
    throw new Error("CC0 source validation failed");
  const found: any[] = [];
  parsed.rows.forEach((r: unknown, index: number) => {
    if (found.length >= MAX_ROWS || !Array.isArray(r) || r[0] !== make ||
      r[1] !== model || r[2] !== year || !safeName(r[3]) ||
      typeof r[4] !== "string" || r[4].length > 200 || !Array.isArray(r[5])) return;
    const ref = r[5].filter((p: unknown) => Array.isArray(p) &&
      Number.isInteger(p[0]) && p[0] >= 0 && p[0] < 6 &&
      typeof p[1] === "string" && /^[A-Za-z0-9][A-Za-z0-9._/-]{3,23}$/.test(p[1])).slice(0, 6);
    if (ref.length) found.push({
      make, model, model_year: year, source_row_index: index,
      source_vehicle: r[3], source_engine: r[4],
      part_references: ref, source_url: SOURCE, source_license: "CC0-1.0",
      verification_status: "unverified",
    });
  });
  return found;
}
Deno.serve(async (req: Request) => {
  const {allowed, headers, json: respond} = siteRequest(req, "content-type, apikey");
  if (!allowed) return respond({ error: "Origin not permitted" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  const apikey = req.headers.get("apikey") || "";
  if (!apikey || !publicKeys().includes(apikey)) return respond({ error: "Invalid publishable key" }, 401);
  try {
    if (Number(req.headers.get("content-length") || 0) > 512) return respond({ error: "Request too large" }, 413);
    const request = await req.json();
    if (!request || typeof request !== "object" || Array.isArray(request) ||
      Object.keys(request).some(k => !["make","model","year","category"].includes(k)))
      return respond({ error: "Only make, model, year and category supported" }, 400);
    const { make, model, category } = request, year = Number(request.year);
    if (!safeName(make) || !safeName(model) || !Number.isInteger(year) ||
      year < 1980 || year > 2026 || category !== "oilfilter")
      return respond({ error: "Unsupported vehicle or part category" }, 422);
    // Only the same curated makes and models selectable on our frontend can trigger work.
    const brand = await db("car_brands", "GET", { select: "id", name: "eq." + make, limit: "1" });
    if (!brand.length) return respond({ error: "Unknown curated brand" }, 422);
    const known = await db("car_models", "GET", {
      select: "id", name: "eq." + model, brand_id: "eq." + brand[0].id, limit: "1",
    });
    if (!known.length) return respond({ error: "Unknown curated model" }, 422);
    const hit = await cached(make, model, year);
    if (hit.recent) return respond({ rows: hit.rows, source: "database", stored: 0, verified: false, license: "CC0-1.0" });
    // Bounded free-plan protection: at most 120 SOURCE lookups/day across all visitors.
    const limit = await db("open_oilfilter_search_cache", "GET", {
      select: "make", checked_at: "gte." + new Date(Date.now() - 86400000).toISOString(),
      limit: String(DAY_BUDGET + 1),
    });
    if (limit.length >= DAY_BUDGET) {
      if (hit.rows.length) return respond({ rows: hit.rows, source: "database-stale", stored: 0, verified: false, license: "CC0-1.0" });
      return respond({ error: "Daily lookup budget reached; try again later" }, 429);
    }
    const discovered = await sourceRows(make, model, year);
    if (discovered.length) await db("open_oilfilter_cache", "POST", {
      on_conflict: "make,model,model_year,source_row_index",
    }, discovered);
    await db("open_oilfilter_search_cache", "POST", {
      on_conflict: "make,model,model_year",
    }, [{ make, model, model_year: year, result_count: discovered.length, checked_at: new Date().toISOString() }]);
    return respond({ rows: rowsToClient(discovered), source: "newly-saved", stored: discovered.length, verified: false, license: "CC0-1.0" });
  } catch (e) {
    console.error("CarParts community lookup failed", e instanceof Error ? e.message : "unknown");
    return respond({ error: "Community source temporarily unavailable" }, 503);
  }
});
