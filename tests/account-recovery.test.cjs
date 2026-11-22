const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {test} = require("node:test");
const {runInNewContext} = require("node:vm");

const site = "https://zzfizez-ux.github.io/CarParts/";
const testUser = {email: "customer@example.invalid"};
const recoverySession = {user: testUser};
const source = readFileSync(join(__dirname, "../account.js"), "utf8");

function fixture(href, verifyOtp = async () => ({data: {session: recoverySession}})) {
  const node = () => ({value: "", textContent: "", closest: () => ({}), addEventListener() {}});
  const fields = {email: node(), password: node(), code: node()};
  const title = node();
  const status = node();
  const primary = node();
  const account = node();
  const recoveryButton = {...node(), dataset: {go: "recover"}};
  const codeButton = {...node(), dataset: {go: "verify"}};
  const form = {elements: fields, querySelector: () => primary};
  const dialogs = {form, h2: title, "[role=status]": status, "[data-close]": node(), "[data-identity]": node()};
  const dialog = {
    open: false,
    querySelector: selector => dialogs[selector],
    querySelectorAll: selector => selector === "[data-go]" ? [recoveryButton, codeButton] : [],
    addEventListener() {},
    showModal() { this.open = true; },
    close() { this.open = false; }
  };
  let verifiedUserListener;
  const calls = [];
  const auth = {
    onAuthStateChange(callback) { verifiedUserListener = callback; },
    async resetPasswordForEmail(email, options) { calls.push({email, redirectTo: options.redirectTo}); return {}; },
    async verifyOtp({email, token, type}) { calls.push({email, token, type}); return verifyOtp(); },
    async updateUser({password}) { calls.push({password}); return {}; }
  };
  runInNewContext(source, {
    URL, URLSearchParams, location: {href},
    history: {replaceState(_, __, next) { calls.push(next); }},
    document: {getElementById: id => id === "accountDialog" ? dialog : account},
    window: {
      CARPARTS_SUPABASE_CONFIG: {url: "https://project.example", publishableKey: "public"},
      supabase: {createClient: () => ({auth})}
    }
  });

  return {
    fields, title, status, account, recoveryButton, codeButton, primary, dialog, calls,
    submit: () => form.onsubmit({preventDefault() {}}),
    authEvent: (event, session) => verifiedUserListener(event, session)
  };
}

test("a recovery email opens code entry with the email field enabled", async () => {
  const page = fixture(site + "?account=recovery&campaign=keep");
  assert.equal(page.calls[0], site + "?campaign=keep");
  assert.equal(page.dialog.open, true);
  assert.equal(page.title.textContent, "E-Mail-Code eingeben");
  assert.equal(page.fields.email.disabled, false);
  assert.equal(page.fields.password.disabled, true);

  page.fields.email.value = testUser.email;
  page.fields.code.value = "123456";
  await page.submit();
  assert.deepEqual(page.calls[1], {email: testUser.email, token: "123456", type: "recovery"});
  assert.equal(page.title.textContent, "Neues Passwort wählen");
  assert.equal(page.fields.password.minLength, 12);

  page.dialog.close();
  page.account.onclick();
  assert.equal(page.title.textContent, "Neues Passwort wählen");
  page.fields.password.value = "test-password";
  await page.submit();
  assert.deepEqual(page.calls[2], {password: "test-password"});
  assert.equal(page.title.textContent, "Mein Konto");
});

test("an expired code leaves the customer on code entry", async () => {
  const page = fixture(site + "?account=recovery", async () => ({error: {code: "otp_expired"}}));
  page.fields.email.value = testUser.email;
  page.fields.code.value = "123456";
  await page.submit();
  assert.equal(page.title.textContent, "E-Mail-Code eingeben");
  assert.equal(page.fields.code.value, "");
  assert.equal(page.fields.password.disabled, true);
  assert.match(page.status.textContent, /ungültig oder abgelaufen/);
});

test("Supabase's expired-link redirect opens recovery and removes its error fragment", () => {
  const page = fixture(site + "?lang=de#error=access_denied&error_code=otp_expired&error_description=example");
  assert.equal(page.calls[0], site + "?lang=de");
  assert.equal(page.title.textContent, "Passwort vergessen");
  assert.match(page.status.textContent, /eine neue E-Mail/);
  assert.equal(page.dialog.open, true);
});

test("a reset request points back to the site's root directory", async () => {
  const base = "https://carparts.example/shop/";
  const page = fixture(base + "index.html#finder");
  page.recoveryButton.onclick();
  page.fields.email.value = testUser.email;
  await page.submit();
  assert.deepEqual(page.calls[0], {email: testUser.email, redirectTo: base});
  assert.equal(page.title.textContent, "Postfach prüfen");
  assert.equal(page.primary.hidden, true);
  assert.match(page.status.textContent, /Öffne den Link/);
  page.codeButton.onclick();
  assert.equal(page.title.textContent, "E-Mail-Code eingeben");
  assert.equal(page.primary.hidden, false);
});

test("a valid direct Supabase recovery session still opens the new password form", async () => {
  const page = fixture(site);
  await Promise.resolve();
  page.authEvent("PASSWORD_RECOVERY", recoverySession);
  assert.equal(page.title.textContent, "Neues Passwort wählen");
  assert.equal(page.dialog.open, true);
});
