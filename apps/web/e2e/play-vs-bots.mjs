// Plays a whole game in a real browser against 3 bots, clicking through the UI like a
// person, and saves screenshots. Fails on any browser error.
//
//   TRIX_SPEED=10 PORT=8123 node apps/server/dist/index.js     (after npm run build)
//   node apps/web/e2e/play-vs-bots.mjs OUT_DIR [--base http://127.0.0.1:8123] [--viewport 390x844]
// Set CHROMIUM=/path/to/chrome to use a specific Chromium build.

import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = process.argv[2] ?? "e2e-out";
const base = process.argv.includes("--base") ? process.argv[process.argv.indexOf("--base") + 1] : "http://127.0.0.1:8123";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const vp = process.argv.includes("--viewport") ? process.argv[process.argv.indexOf("--viewport") + 1].split("x").map(Number) : null;
const phone = !!vp && vp[0] < 600;
const page = await browser.newPage({ viewport: vp ? { width: vp[0], height: vp[1] } : { width: 1440, height: 900 }, ...(phone ? { hasTouch: true } : {}) });
const problems = [];
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));

const taken = new Set();
async function shot(name, { once = true } = {}) {
  if (once && taken.has(name)) return;
  taken.add(name);
  await page.screenshot({ path: `${out}/${String(taken.size).padStart(2, "0")}-${name}.png` });
}
const visible = async (sel) => (await page.locator(sel).count()) > 0 && page.locator(sel).first().isVisible();

// Home → create a table → add 3 bots (the game starts on its own).
await page.goto(base);
await shot("home");
await page.fill("#name", "Seif");
await page.click("text=Create a table");
await page.waitForSelector(".lobby");
await page.click('button:has-text("Add a bot")');
await shot("lobby");
await page.click('button:has-text("Add a bot")');
await page.click('button:has-text("Add a bot")');
await page.waitForSelector(".table-screen");

// Prefer contracts we haven't seen yet, so screenshots cover trix and ray early.
const preference = ["trix", "ray", "general", "dineri", "damet", "pli", "farcha"];
let contracts = 0;
let peeked = 0;
let reloaded = false;
let resized = false;
const deadline = Date.now() + 15 * 60 * 1000;

while (Date.now() < deadline) {
  if (await visible(".gameover")) {
    await page.waitForTimeout(400);
    await shot("game-over");
    break;
  }
  if (await visible(".summary")) {
    const title = await page.locator(".summary h2").innerText();
    await shot(`summary-${title.split(" ")[0].toLowerCase()}`);
    const btn = page.locator('.summary button:has-text("Continue")');
    if (await btn.isEnabled().catch(() => false)) await btn.click();
    await page.waitForTimeout(150);
    continue;
  }
  if (await visible(".picker")) {
    contracts++;
    await shot("picker");
    const enabled = await page.locator(".contract-tile:not([disabled]) strong").allInnerTexts();
    const choice = preference.find((c) => enabled.includes(c.toUpperCase())) ?? enabled[0].toLowerCase();
    await page.click(`.contract-tile:not([disabled]):has(strong:text-is("${choice.toUpperCase()}"))`);
    await page.waitForTimeout(250);
    await shot(`picked-${choice}`);
    continue;
  }
  if (await visible(".choosing")) {
    await shot("someone-else-choosing");
    await page.waitForTimeout(100);
    continue;
  }
  if (await visible(".trick.done")) await shot("trick-taken");
  if (await visible(".trix-column .card")) await shot("trix-in-progress");
  if (await visible(".paused")) await shot("paused");

  // After a few contracts: refresh the page mid-game (must come back to the same seat),
  // and take one phone-sized screenshot.
  if (!reloaded && contracts >= 2) {
    reloaded = true;
    await page.reload();
    await page.waitForSelector(".table-screen", { timeout: 15000 });
    await shot("after-refresh");
  }
  // Phones: the leaderboard, feed and Leave live in a sheet behind "Scores".
  if (phone && !taken.has("scores-sheet") && contracts >= 2 && (await visible(".side-toggle"))) {
    await page.click(".side-toggle");
    await page.waitForTimeout(400);
    await shot("scores-sheet");
    await page.click(".side-close");
    await page.waitForTimeout(300);
  }
  if (!resized && !vp && contracts >= 3) {
    resized = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await shot("phone");
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  if (await visible("button.declare")) {
    await page.click("button.declare");
    await page.waitForTimeout(200);
    await shot("declared-king");
    continue;
  }
  const legal = page.locator(".hand .card.legal");
  if ((await legal.count()) > 0) {
    const peekBtn = page.locator('button:has-text("Last trick")');
    if (peeked < 2 && (await peekBtn.isEnabled().catch(() => false))) {
      peeked++;
      await peekBtn.click();
      await page.waitForSelector(".peek", { timeout: 3000 });
      await shot("last-trick-peek");
      await page.click(".peek");
    }
    if ((await legal.count()) > 1) await shot("my-turn");
    await legal.first().click();
    await page.waitForTimeout(120);
    continue;
  }
  await page.waitForTimeout(120);
}

const feed = await page.locator(".feed-list p").allInnerTexts();
writeFileSync(`${out}/feed.txt`, feed.join("\n") + "\n");
await browser.close();

const finished = taken.has("game-over");
console.log(`contracts picked by the human: ${contracts}, screenshots: ${taken.size}, finished: ${finished}`);
if (problems.length) console.log(problems.join("\n"));
if (!finished || problems.length) process.exit(1);
