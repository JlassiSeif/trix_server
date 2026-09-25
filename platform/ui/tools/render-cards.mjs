// Renders the shared card deck (docs/game-look.md: card faces stay GNOME Aisleriot's "bonded"
// theme for now, GPL-3.0-or-later) from its vector sheet at twice the old size, so every card game
// uses the same sharp faces: 158×246 WebP (quality 92), about 6 KB each. Output:
// platform/ui/src/assets/cards/<rank>_<suit>.webp (rank a 2 … 10 j q k; suit c d h s),
// joker_red.webp, joker_black.webp.
//
//   node platform/ui/tools/render-cards.mjs [/usr/share/aisleriot/cards/bonded.svg]

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const src = process.argv[2] ?? "/usr/share/aisleriot/cards/bonded.svg";
const out = join(dirname(fileURLToPath(import.meta.url)), "../src/assets/cards");
const SUITS = { c: "club", d: "diamond", h: "heart", s: "spade" };
const RANKS = { a: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", j: "jack", q: "queen", k: "king" };
const cards = [
  ...Object.entries(RANKS).flatMap(([r, rid]) => Object.entries(SUITS).map(([s, sid]) => [`${r}_${s}`, `${rid}_${sid}`])),
  ["joker_red", "red_joker"],
  ["joker_black", "black_joker"],
];

const W = 158, H = 246;
const svg = readFileSync(src, "utf8").replace(/<\?xml[^>]*>/, "");
const browser = await chromium.launch();
const page = await browser.newPage();
// The sheet at its natural size: one SVG unit is one CSS pixel, so a card's box is its viewBox.
await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
const sheet = svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, "<svg$1");
for (const [file, id] of cards) {
  const data = await page.evaluate(
    async ({ id, sheet, W, H }) => {
      const r = document.getElementById(id).getBoundingClientRect();
      const one = sheet.replace(/viewBox="[^"]*"/, `viewBox="${r.x} ${r.y} ${r.width} ${r.height}" width="${W}" height="${H}" preserveAspectRatio="none"`);
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([one], { type: "image/svg+xml" }));
      await img.decode();
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      c.getContext("2d").drawImage(img, 0, 0, W, H);
      return c.toDataURL("image/webp", 0.92);
    },
    { id, sheet, W, H },
  );
  writeFileSync(join(out, `${file}.webp`), Buffer.from(data.split(",")[1], "base64"));
}
await browser.close();
console.log(`${cards.length} cards in ${out}`);
