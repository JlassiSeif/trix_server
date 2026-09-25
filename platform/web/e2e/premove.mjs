// R-TABLE-14 in a real browser against bots: drag and drop, and premoves like chess.com.
// Bots play at normal speed here so there's time to premove between turns.
//
//   PORT=8126 node platform/server/dist/index.js      (after npm run build; no TRIX_SPEED)
//   node platform/web/e2e/premove.mjs OUT_DIR [--base http://127.0.0.1:8126] [--viewport 390x844]

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const out = process.argv[2] ?? "premove-out";
const arg = (name, dflt) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : dflt);
const base = arg("base", "http://127.0.0.1:8126");
const [vw, vh] = arg("viewport", "1280x800").split("x").map(Number);
mkdirSync(out, { recursive: true });

let failed = 0;
const check = (ok, what) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: vw, height: vh } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base + "/trix");
await page.fill("#name", "Seif");
await page.click("button.solo-level.medium");
await page.waitForSelector(".hand .card");

const hand = () => page.locator(".hand .card:not(.drag-ghost)").evaluateAll((els) => els.map((e) => e.alt));
const count = (sel) => page.locator(sel).count();
/** Drags a hand card to the middle of the table with the mouse. */
async function dragToTable(locator, shot) {
  const box = await locator.boundingBox();
  const felt = await page.locator(".felt").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, box.y - 20, { steps: 3 });
  await page.mouse.move(felt.x + felt.width / 2, felt.y + felt.height * 0.42, { steps: 8 });
  if (shot) await page.screenshot({ path: `${out}/${shot}.png` });
  await page.mouse.up();
}
/** Keeps the game going (picks a contract, and plays on our turn unless `ourTurn` is what we're
 *  waiting for) until `cond` holds. */
async function until(cond, what, ms = 90000, ourTurn = false) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await cond()) return true;
    if (await count(".picker .contract-tile:not(.disabled)")) await page.locator(".picker .contract-tile:not(.disabled)").first().click().catch(() => {});
    else if (await count(".summary button:not([disabled])")) await page.locator(".summary button:not([disabled])").first().click().catch(() => {});
    else if (!ourTurn && (await count(".hand .card.legal"))) await page.locator(".hand .card.legal").first().click().catch(() => {});
    await page.waitForTimeout(80);
  }
  console.log(`(gave up waiting for: ${what})`);
  await page.screenshot({ path: `${out}/stuck-${what.replace(/\W+/g, "-")}.png` });
  return false;
}
const window = () => count(".hand .card.can-premove").then((n) => n > 0);

// 1. Premove by dragging, then it plays by itself on our turn.
let played = false;
for (let attempt = 0; attempt < 6 && !played; attempt++) {
  if (!(await until(window, "a premove window"))) break;
  const card = page.locator(".hand .card.can-premove").first();
  const alt = await card.getAttribute("alt");
  await dragToTable(card);
  if (!(await count(".hand .card.premove"))) continue; // our turn came in the meantime
  if (attempt === 0) {
    check((await page.locator(".turn-hint").textContent()).includes(alt), `the turn hint shows the premove (${alt})`);
    await page.screenshot({ path: `${out}/premove-set.png` });
  }
  const gone = await until(async () => !(await hand()).includes(alt) || (await count(".toast")) > 0 && !(await count(".hand .card.premove")), "the premove to resolve", 30000, true);
  if (gone && !(await hand()).includes(alt)) {
    played = true;
    check(true, `a premoved card (${alt}) was played on our turn without a click`);
  } else if (gone) console.log(`(premove ${alt} was cancelled: it couldn't be played; trying again)`);
}
check(played, "a premove got played");

// 2. Tap a card, tap it again: cancelled. Tap, then tap the table: cancelled. Right-click: cancelled.
await until(window, "a premove window");
let c = page.locator(".hand .card.can-premove").first();
const alt2 = await c.getAttribute("alt");
await c.click();
const set2 = (await count(".hand .card.premove")) === 1;
await page.locator(`.hand .card[alt="${alt2}"]`).click();
check(set2 && (await count(".hand .card.premove")) === 0, "tapping a card premoves it; tapping it again cancels");

await until(window, "a premove window");
await page.locator(".hand .card.can-premove").first().click();
const set3 = (await count(".hand .card.premove")) === 1;
const felt = await page.locator(".felt").boundingBox();
await page.mouse.click(felt.x + felt.width * 0.5, felt.y + felt.height * 0.25);
check(set3 && (await count(".hand .card.premove")) === 0, "tapping the table cancels a premove");

await until(window, "a premove window");
await page.locator(".hand .card.can-premove").first().click();
const set4 = (await count(".hand .card.premove")) === 1;
await page.mouse.click(felt.x + felt.width * 0.5, felt.y + felt.height * 0.25, { button: "right" });
check(set4 && (await count(".hand .card.premove")) === 0, "right-clicking cancels a premove");

// 3. Cards that surely can't be played (the suit led is known and we hold it) can't be premoved.
if (await until(() => count(".hand .card.blocked").then((n) => n > 0), "a known lead suit we hold", 240000)) {
  const b = page.locator(".hand .card.blocked").first();
  await b.click({ force: true });
  check((await count(".hand .card.premove")) === 0, "a card that can't follow the suit led can't be premoved");
  await page.screenshot({ path: `${out}/blocked.png` });
} else check(false, "saw a trick where some cards can't be premoved");

// 4. On our turn, dragging a card onto the table plays it.
await until(() => count(".hand .card.legal").then((n) => n > 0), "our turn", 90000, true);
const legal = page.locator(".hand .card.legal").first();
const alt5 = await legal.getAttribute("alt");
await dragToTable(legal, "dragging");
await page.waitForTimeout(600);
check(!(await hand()).includes(alt5), `dragging ${alt5} onto the table on our turn plays it`);

// 5. A drag that ends on the hand plays nothing.
await until(() => count(".hand .card.legal").then((n) => n > 1), "our turn with two legal cards", 90000, true);
const l6 = page.locator(".hand .card.legal").first();
const alt6 = await l6.getAttribute("alt");
const box = await l6.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(400);
check((await hand()).includes(alt6), "dropping a card back on the hand plays nothing");

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
