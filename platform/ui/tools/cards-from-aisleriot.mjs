// The shared deck's faces come from GNOME Aisleriot's ORIGINAL "bonded" deck (GPL), the one Seif's
// 2023 game used: /usr/share/aisleriot/cards/bonded.svgz. (On Ubuntu, bonded.svg is replaced by a
// different design from the branding-ubuntu package; Seif rejected that look, 2026-09-25.)
// The sheet is a 13×5 grid of 79×123 cells: ace to king across; clubs, diamonds, hearts, spades
// down; the last row holds the black joker, the red joker and the GNOME back. Each card is cut at
// 1× on black, exactly like the 2023 files (the table rounds the corners).
//
// The 32 cards from 2023 (7 to ace) are kept as they were; this writes only missing files
// (2 to 6, the jokers) unless --all is given.
//   node platform/ui/tools/cards-from-aisleriot.mjs [--all] [--out DIR] [path/to/bonded.svgz]

import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const all = args.includes("--all");
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args[outAt + 1] : join(dirname(fileURLToPath(import.meta.url)), "../src/assets/cards");
const src = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--out") ?? "/usr/share/aisleriot/cards/bonded.svgz";
const svg = (src.endsWith(".svgz") ? gunzipSync(readFileSync(src)) : readFileSync(src)).toString("utf8");

const RANKS = ["a", "2", "3", "4", "5", "6", "7", "8", "9", "10", "j", "q", "k"];
const SUITS = ["c", "d", "h", "s"];
const cells = [
  ...SUITS.flatMap((s, row) => RANKS.map((r, col) => [`${r}_${s}`, col, row])),
  ["joker_black", 0, 4],
  ["joker_red", 1, 4],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1027, height: 615 }, deviceScaleFactor: 1 });
await page.setContent(`<html><body style="margin:0;background:#000">${svg.replace(/<\?xml[^>]*>/, "").replace(/<!DOCTYPE[^>]*>/, "")}</body></html>`);
let written = 0;
for (const [name, col, row] of cells) {
  const file = join(out, `${name}.png`);
  if (!all && existsSync(file)) continue;
  await page.screenshot({ path: file, clip: { x: col * 79, y: row * 123, width: 79, height: 123 } });
  written++;
}
await browser.close();
console.log(`${written} cards written to ${out}`);
