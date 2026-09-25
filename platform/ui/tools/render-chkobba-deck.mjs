// The Chkobba deck (Seif, 2026-09-25: Chkobba and Pablo are played with it, not with the classic
// deck): the drawings by Abjiklam on Wikimedia Commons, pips without numbers, 1 to 7 and queen (8),
// jack (9), king (10). The originals and their licences are in platform/ui/assets-src/chkobba
// (1–7: CC0; the faces and back: CC BY-SA 4.0, credited on the About page). This renders them at
// twice their size to WebP for the site, since the vector faces are far too heavy for phones.
//   node platform/ui/tools/render-chkobba-deck.mjs

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../assets-src/chkobba");
const out = join(here, "../src/assets/decks/chkobba");
const W = 178, H = 262; // 2 × 89 × 131, the drawings' own size

const browser = await chromium.launch();
const page = await browser.newPage();
let n = 0;
for (const f of readdirSync(src).filter((f) => f.endsWith(".svg") && f !== "back.svg")) {
  const svg = readFileSync(join(src, f)).toString("base64");
  const data = await page.evaluate(
    async ({ svg, W, H }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${svg}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      c.getContext("2d").drawImage(img, 0, 0, W, H);
      return c.toDataURL("image/webp", 0.9);
    },
    { svg, W, H },
  );
  writeFileSync(join(out, f.replace(".svg", ".webp")), Buffer.from(data.split(",")[1], "base64"));
  n++;
}
await browser.close();
console.log(`${n} cards written to ${out}`);
