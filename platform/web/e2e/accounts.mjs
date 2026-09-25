// Accounts and languages, the way a player meets them, against Firebase's emulators:
// guests never load Firebase; the language menu (French, Arabic right to left, remembered);
// signing in with an email link; the account page (name, language); the name follows you to a
// table and your seat remembers your account; signing in with Google (the emulator's stand-in);
// deleting the account. Screenshots of the new pages in all three languages go to OUT_DIR.
//
// Needs the emulators (npm run emulators) and a server started against them, e.g.
//   PORT=8125 FIREBASE_PROJECT_ID=demo-dineri FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 TRIX_STATE_FILE=/tmp/rooms.json node platform/server/dist/index.js
//   node platform/web/e2e/accounts.mjs OUT_DIR [--base http://127.0.0.1:8125] [--state /tmp/rooms.json]

import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const out = process.argv[2] ?? "accounts-out";
const arg = (name, dflt) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : dflt);
const base = arg("base", "http://127.0.0.1:8125");
const stateFile = arg("state", null);
const AUTH = "http://127.0.0.1:9099";
const PROJECT = "demo-dineri";
mkdirSync(out, { recursive: true });

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });

/** A fresh browser (own storage), with its page errors and blocked loads collected. */
async function fresh(viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ viewport, locale: "en-US" });
  const page = await ctx.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && problems.push(`blocked: ${m.text()}`));
  const loaded = [];
  page.on("request", (r) => loaded.push(r.url()));
  return { ctx, page, problems, loaded };
}

async function linkFor(email) {
  const res = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = await res.json();
  const code = oobCodes.filter((c) => c.email === email && c.requestType === "EMAIL_SIGNIN").at(-1);
  return code?.oobLink ?? null;
}

async function userExists(email) {
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer owner" },
    body: JSON.stringify({ expression: [{ email }], returnUserInfo: true }),
  });
  const body = await res.json();
  return (body.userInfo ?? []).length > 0;
}

// 1. A guest: no Firebase download, a way to sign in, the footer.
{
  const { ctx, page, problems, loaded } = await fresh();
  await page.goto(base + "/");
  await page.waitForSelector(".game-card");
  await page.waitForSelector("button.sign-in");
  check(!loaded.some((u) => /firebase/i.test(u)), "a guest's page doesn't download Firebase");
  check(await page.isVisible(".footer >> text=Privacy"), "footer links are there");

  // 2. Languages.
  await page.click(".lang-button");
  await page.click('.lang-list button[lang="fr"]');
  check((await page.textContent("h1")) === "Invitez vos amis à la table.", "French: the home page speaks French");
  check((await page.getAttribute("html", "lang")) === "fr", "French: <html lang=fr>");
  await page.click(".lang-button");
  await page.click('.lang-list button[lang="ar"]');
  check((await page.getAttribute("html", "dir")) === "rtl", "Arabic: the page turns right to left");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/ar-desk-home.png`, fullPage: true });
  await page.reload();
  await page.waitForSelector(".game-card");
  check((await page.getAttribute("html", "lang")) === "ar", "the language choice survives a reload");
  await page.goto(base + "/nowhere");
  check(await page.isVisible("text=لا طاولة هنا"), "404 page, in Arabic");
  await page.screenshot({ path: `${out}/ar-desk-404.png`, fullPage: true });
  await page.goto(base + "/trix");
  await page.fill("#name", "Seif");
  await page.click("button.solo-level.easy");
  await page.waitForSelector(".hand .card", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/ar-desk-table.png` });
  check(await page.isVisible(".scoreboard >> text=الترتيب"), "the Trix table works in Arabic");
  check((await page.getAttribute(".felt", "dir")) === "ltr", "the table's seats keep their places in Arabic");
  check(problems.length === 0, `guest pages ran clean${problems.length ? `: ${problems.join(" | ")}` : ""}`);
  await ctx.close();
}

// 3. Signing in with an email link; the account page; the name follows you to a table.
const email = `amel.${Date.now()}@example.com`;
{
  const { ctx, page, problems, loaded } = await fresh();
  await page.goto(base + "/");
  await page.click("button.sign-in");
  await page.waitForSelector(".hub-dialog[open]");
  await page.screenshot({ path: `${out}/en-desk-signin.png` });
  await page.fill("#signin-email", email);
  await page.click('.hub-dialog button[type="submit"]');
  await page.waitForSelector(".hub-dialog .sent");
  check(loaded.some((u) => /firebase/i.test(u)), "Firebase loads once someone signs in");
  const link = await linkFor(email);
  check(!!link, "the emulator got the sign-in email");
  await page.goto(link);
  // The emulator's action page forwards to our /signin with the code.
  await page.waitForURL(/\/signin/, { timeout: 15000 });
  await page.waitForSelector("text=Signed in as", { timeout: 15000 });
  check(true, "the email link signs you in (same browser: no questions)");
  await page.click("text=Go to the games");
  await page.waitForSelector(".avatar");
  check((await page.textContent(".avatar")) === "A", "signed in: your initial in the top bar");

  await page.click(".avatar");
  await page.waitForSelector("#acc-name");
  check((await page.inputValue("#acc-name")).startsWith("amel."), "a new account is named after the email until you change it");
  await page.fill("#acc-name", "Amel");
  await page.click('.account-page button[type="submit"]');
  await page.waitForSelector("text=Saved");
  check(true, "you can change your name at the table");
  await page.click('.lang-choice button[lang="fr"]');
  await page.waitForSelector("text=Votre compte");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/fr-desk-account.png`, fullPage: true });

  await page.goto(base + "/trix");
  await page.waitForSelector("#name");
  check((await page.inputValue("#name")) === "Amel", "a game's page offers your account's name");
  await page.click("button.solo-level.medium");
  await page.waitForSelector(".hand .card", { timeout: 15000 });
  if (stateFile) {
    await page.waitForTimeout(2500); // rooms are saved a moment after changes
    const saved = readFileSync(stateFile, "utf8");
    check(/"uid":"[A-Za-z0-9]+"/.test(saved) && saved.includes('"Amel"'), "the seat remembers the account (saved with the room)");
  }
  check(problems.length === 0, `signed-in pages ran clean${problems.length ? `: ${problems.join(" | ")}` : ""}`);
  await ctx.close();
}

// 4. Another device: signing in brings your language along; then delete everything.
{
  const { ctx, page, problems } = await fresh({ width: 390, height: 844 });
  await page.goto(base + "/");
  await page.click("button.sign-in");
  await page.fill("#signin-email", email);
  await page.click('.hub-dialog button[type="submit"]');
  await page.waitForSelector(".hub-dialog .sent");
  await page.screenshot({ path: `${out}/en-phone-signin-sent.png` });
  await page.goto(await linkFor(email));
  await page.waitForURL(/\/signin/, { timeout: 15000 });
  await page.waitForSelector("text=Connecté en tant que Amel", { timeout: 15000 });
  check((await page.getAttribute("html", "lang")) === "fr", "your account's language follows you to a new device");
  await page.goto(base + "/account");
  await page.waitForSelector(".danger-zone");
  await page.screenshot({ path: `${out}/fr-phone-account.png`, fullPage: true });
  await page.click(".danger-zone button.danger");
  await page.click("text=Oui, supprimer mon compte");
  await page.waitForSelector("text=Votre compte a été supprimé.");
  check(!(await userExists(email)), "deleting the account removes the sign-in too");
  await page.goto(base + "/");
  await page.waitForSelector("button.sign-in");
  check(true, "after deleting: a guest again");
  check(problems.length === 0, `phone pages ran clean${problems.length ? `: ${problems.join(" | ")}` : ""}`);
  await ctx.close();
}

// 5. Google (the emulator's stand-in pop-up).
{
  const { ctx, page, problems } = await fresh();
  await page.goto(base + "/");
  await page.click("button.sign-in");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("button.google")]);
  await popup.waitForLoadState();
  await popup.click("text=Add new account");
  await popup.waitForSelector("#autogen-button");
  await popup.click("#autogen-button");
  await popup.fill("#display-name-input", "Sami Ben Ali");
  await popup.click("#sign-in");
  await page.waitForSelector(".avatar", { timeout: 15000 });
  check((await page.textContent(".avatar")) === "S", "Google sign-in (emulator): signed in with Google's name");
  await page.click(".avatar");
  await page.waitForSelector("#acc-name");
  check((await page.inputValue("#acc-name")) === "Sami Ben Ali", "the profile starts from the Google name");
  await page.click("text=Sign out");
  await page.waitForSelector("text=You're not signed in.");
  await page.goto(base + "/");
  await page.waitForSelector("button.sign-in");
  check(true, "signing out makes you a guest");
  check(problems.length === 0, `Google flow ran clean${problems.length ? `: ${problems.join(" | ")}` : ""}`);
  await ctx.close();
}

// 6. The plain pages in each language, desk and phone.
for (const lang of ["en", "fr", "ar"]) {
  for (const [w, h, device] of [
    [1280, 800, "desk"],
    [390, 844, "phone"],
  ]) {
    const { ctx, page } = await fresh({ width: w, height: h });
    await page.addInitScript((l) => localStorage.setItem("dineri.lang", l), lang);
    await page.goto(base + "/");
    await page.waitForSelector(".game-card");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/${lang}-${device}-home.png`, fullPage: true });
    await page.goto(base + "/privacy");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/${lang}-${device}-privacy.png`, fullPage: true });
    await page.goto(base + "/trix");
    await page.waitForSelector("#name");
    await page.screenshot({ path: `${out}/${lang}-${device}-trix.png`, fullPage: true });
    await ctx.close();
  }
}

await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
