const githubPages = "https://zzfizez-ux.github.io/CarParts/";

function siteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash ? url : null;
  } catch {
    return null;
  }
}

function siteOrigins(configured) {
  const origins = configured.split(",")
    .map(value => siteUrl(value.trim()))
    .filter(url => url?.pathname === "/")
    .map(url => url.origin);
  return new Set(origins.length ? origins : [new URL(githubPages).origin]);
}

export function siteRequest(request, requestHeaders, {
  allowedOrigins = Deno.env.get("CARPARTS_ALLOWED_ORIGINS") ?? "",
  allowWithoutOrigin = false
} = {}) {
  const origin = request.headers.get("Origin");
  const allowedOrigin = origin !== null && siteOrigins(allowedOrigins).has(origin);
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders,
    "Cache-Control": "no-store",
    Vary: "Origin"
  });
  if (allowedOrigin) headers.set("Access-Control-Allow-Origin", origin);

  return {
    allowed: allowedOrigin || (origin === null && allowWithoutOrigin),
    headers,
    json: (body, status = 200) => Response.json(body, {status, headers})
  };
}

export function primarySiteUrl(
  configured = Deno.env.get("CARPARTS_SITE_URL") ?? "",
  allowedOrigins = Deno.env.get("CARPARTS_ALLOWED_ORIGINS") ?? ""
) {
  const url = siteUrl(configured.trim());
  return url && siteOrigins(allowedOrigins).has(url.origin) ? url.href : githubPages;
}
