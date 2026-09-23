// Checks that timed UI goes away on its own, at normal bot speed:
// the pick banner, the completed trick, and the last-trick look (R-TRICK-6).
//
//   PORT=8124 node apps/server/dist/index.js      (normal speed, after npm run build)
//   node apps/web/e2e/timed-ui.mjs [--base http://127.0.0.1:8124]

import { chromium } from "playwright";

const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://127.0.0.1:8124";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));

const count = (sel) => page.locator(sel).count();
/** Poll until `sel` is gone; returns how long it stayed (ms), or null if it never went away. */
async function goneWithin(sel, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if ((await count(sel)) === 0) return Date.now() - start;
    await page.waitForTimeout(100);
  }
  return null;
}
/** Take my turn if it is mine (pick the first contract, or play the first legal card). */
async function playIfMyTurn() {
  if (await count(".picker")) await page.locator(".contract-tile:not([disabled])").first().click();
  else if (await count(".hand .card.legal")) await page.locator(".hand .card.legal").first().click();
  else if (await count('.summary button:has-text("Continue"):not([disabled])')) await page.click('.summary button:has-text("Continue")');
}

await page.goto(base);
await page.fill("#name", "Checker");
await page.click("text=Create a table");
await page.waitForSelector(".lobby");
for (let i = 0; i < 3; i++) await page.click('button:has-text("Add a bot")');
await page.waitForSelector(".table-screen");

// 1. The "X chose ..." banner hides itself (it used to stay until the next banner).
let checkedToast = false;
let checkedTrick = false;
let checkedPeek = false;
const deadline = Date.now() + 5 * 60 * 1000;
while (Date.now() < deadline && !(checkedToast && checkedTrick && checkedPeek)) {
  if (!checkedToast && (await count(".toast"))) {
    const text = await page.locator(".toast").innerText();
    const stayed = await goneWithin(".toast", 4000);
    if (stayed === null) failures.push(`banner "${text}" still showing after 4 s`);
    else console.log(`banner "${text}" hid itself`);
    checkedToast = true;
    continue;
  }
  // 2. A completed trick clears after its short display, even if nobody leads yet.
  if (!checkedTrick && (await count(".trick.done"))) {
    const stayed = await goneWithin(".trick.done", 2500);
    if (stayed === null) failures.push("completed trick still on the table after 2.5 s");
    else console.log("completed trick cleared");
    checkedTrick = true;
    continue;
  }
  // 3. The last-trick look closes by itself.
  if (checkedTrick && !checkedPeek && (await page.locator('button:has-text("Last trick")').isEnabled().catch(() => false))) {
    await page.click('button:has-text("Last trick")');
    await page.waitForSelector(".peek", { timeout: 3000 });
    const stayed = await goneWithin(".peek", 5500);
    if (stayed === null) failures.push("last-trick look did not close by itself");
    else console.log("last-trick look closed by itself");
    checkedPeek = true;
    continue;
  }
  await playIfMyTurn();
  await page.waitForTimeout(150);
}
await browser.close();
if (!(checkedToast && checkedTrick && checkedPeek)) failures.push("did not reach all three checks in time");
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("timed UI: all good");
