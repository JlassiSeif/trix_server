// Screenshots of the hub pages (home, a game's page, the lobby) at desktop and phone size, to
// LOOK at before handing a visual change to Seif. Needs a running server.
//
//   node platform/web/e2e/look.mjs OUT_DIR [--base http://127.0.0.1:8124] [--tag before]

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const out = process.argv[2] ?? "look-out";
const arg = (name, dflt) => (process.argv.includes(`--${name}`) ? process.argv[process.argv.indexOf(`--${name}`) + 1] : dflt);
const base = arg("base", "http://127.0.0.1:8124");
const tag = arg("tag", "look");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const [w, h, device] of [[1280, 800, "desk"], [390, 844, "phone"]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/");
  await p.waitForSelector(".game-card");
  await p.waitForTimeout(300); // fonts
  await p.screenshot({ path: `${out}/${tag}-${device}-home.png`, fullPage: true });
  await p.goto(base + "/trix");
  await p.fill("#name", "Seif");
  await p.screenshot({ path: `${out}/${tag}-${device}-trix.png`, fullPage: true });
  await p.click("text=Create a table");
  await p.waitForSelector(".lobby");
  await p.screenshot({ path: `${out}/${tag}-${device}-lobby.png`, fullPage: true });
  await p.close();
  if (errors.length) console.log(`${device}: page errors: ${errors.join("; ")}`);
}
await browser.close();
console.log(`screenshots in ${out}`);
