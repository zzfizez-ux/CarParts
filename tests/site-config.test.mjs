import assert from "node:assert/strict";
import {test} from "node:test";
import {primarySiteUrl, siteRequest} from "../supabase/functions/_shared/site-config.mjs";

const githubOrigin = "https://zzfizez-ux.github.io";
const ionosOrigin = "https://carparts.example";

function request(origin, allowedOrigins, allowWithoutOrigin = false) {
  const headers = origin === null ? {} : {Origin: origin};
  return siteRequest(new Request("https://supabase.example", {method: "OPTIONS", headers}),
    "content-type, apikey", {allowedOrigins, allowWithoutOrigin});
}

test("GitHub Pages is the default allowed origin", () => {
  const matching = request(githubOrigin, "");
  assert.equal(matching.allowed, true);
  assert.equal(matching.headers.get("Access-Control-Allow-Origin"), githubOrigin);
  assert.equal(matching.headers.get("Vary"), "Origin");
  assert.equal(request(ionosOrigin, "").allowed, false);
});

test("a cutover permits the two configured domains and rejects unrelated origins", () => {
  const origins = `${githubOrigin}, ${ionosOrigin}/`;
  assert.equal(request(githubOrigin, origins).allowed, true);
  assert.equal(request(ionosOrigin, origins).headers.get("Access-Control-Allow-Origin"), ionosOrigin);
  assert.equal(request("https://other.example", origins).headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(request(githubOrigin, ionosOrigin).allowed, false);
});

test("only the notification handler can opt in to requests without an origin", () => {
  assert.equal(request(null, "").allowed, false);
  const serverRequest = request(null, "", true);
  assert.equal(serverRequest.allowed, true);
  assert.equal(serverRequest.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(request("null", "", true).allowed, false);
});

test("email links can use an allowed IONOS subdirectory", () => {
  const configured = `${ionosOrigin}/shop/`;
  assert.equal(primarySiteUrl(configured, ionosOrigin), configured);
  assert.equal(primarySiteUrl(configured, ""), `${githubOrigin}/CarParts/`);
  assert.equal(primarySiteUrl("http://carparts.example/", ionosOrigin), `${githubOrigin}/CarParts/`);
});
