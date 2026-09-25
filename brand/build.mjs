// Builds every Dineri brand asset from two sources: the outlined wordmark (tools/wordmark-paths.json,
// from tools/wordmark.py) and the colour tokens below (the same as tokens.css). Writes:
//   logo/*.svg                 the logo system (brand/BRAND.md §3)
//   png/*.png                  app icons, social avatar, share image
//   ../platform/web/public/    what the website serves (favicon, icons, share image, manifest)
//   LOCK.json                  a fingerprint of every asset (the lock test compares against it)
//
//   node brand/build.mjs            rebuild everything and rewrite LOCK.json (only with Seif's approval)
//
// The brand is locked (brand/BRAND.md): rebuilding may only change files when Seif approved a change.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const web = join(root, "platform/web/public");

// Colours: brand/BRAND.md §4 (tokens.css says the same).
const C = {
  night: "#0f1722",
  felt: "#0f4a33",
  feltHi: "#16603f",
  feltLo: "#0a3524",
  brass: "#c9a04a",
  brassHi: "#e6c46f",
  ivory: "#f3ead8",
  ivoryLo: "#e3d6bc",
  ink: "#1d1a15",
  red: "#b8322b",
  back: "#7a1f26",
};

// ---------------------------------------------------------------- the wordmark
const W = JSON.parse(readFileSync(join(here, "tools/wordmark-paths.json"), "utf8"));
const CAP = W.capHeight; // 732 units
const [, , textRight] = W.bounds;
// The small raised diamond after the name: 60% of the cap height, the proportions of the ♦ suit (5:6).
const DIA_H = Math.round(CAP * 0.6);
const DIA_W = Math.round((DIA_H * 5) / 6);
const DIA_X = Math.round(textRight + 110);
const DIA_CY = Math.round(CAP - CAP * 0.36);
const WORD_W = DIA_X + DIA_W + 20;
const WORD_H = CAP + 30;

const diamond = (cx, cy, w, h, fill) => `<path d="M${cx} ${cy - h / 2} L${cx + w / 2} ${cy} L${cx} ${cy + h / 2} L${cx - w / 2} ${cy} Z" fill="${fill}"/>`;

/** The wordmark's shapes, in a box WORD_W × WORD_H (cap top at 0, baseline at CAP). */
function wordmarkShapes(text, dia) {
  const letters = W.glyphs.map((g) => `<path transform="translate(${g.x} ${CAP}) scale(1 -1)" d="${g.d}"/>`).join("");
  return `<g fill="${text}">${letters}</g>${diamond(DIA_X + DIA_W / 2, DIA_CY, DIA_W, DIA_H, dia)}`;
}
const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;

// ---------------------------------------------------------------- the mark
/** The mark: the red diamond (the dineri) with a brass inner line. Box 500 × 600. */
function markShapes(x, y, scale, { line = C.brassHi, fill = C.red } = {}) {
  const t = `translate(${x} ${y}) scale(${scale})`;
  return `<g transform="${t}"><path d="M250 0 L500 300 L250 600 L0 300 Z" fill="${fill}"/>${
    line ? `<path d="M250 92 L424 300 L250 508 L76 300 Z" fill="none" stroke="${line}" stroke-width="22" stroke-linejoin="miter"/>` : ""
  }</g>`;
}
/** The app icon: the mark on a midnight tile with a lamplight glow. Box 1024². */
function appIconShapes({ maskable = false } = {}) {
  const r = maskable ? 0 : 224;
  const scale = maskable ? 0.9 : 1.18; // maskable: the mark stays inside the safe circle
  const mw = 500 * scale;
  const mh = 600 * scale;
  return `<defs><radialGradient id="glow" cx="50%" cy="8%" r="80%"><stop offset="0" stop-color="#ffba68" stop-opacity=".16"/><stop offset=".6" stop-color="#ffba68" stop-opacity="0"/></radialGradient></defs>
<rect width="1024" height="1024" rx="${r}" fill="${C.night}"/><rect width="1024" height="1024" rx="${r}" fill="url(#glow)"/>
${markShapes((1024 - mw) / 2, (1024 - mh) / 2, scale)}`;
}

// ---------------------------------------------------------------- the files
const files = {};
const out = (path, content) => {
  files[path] = content;
};

// Marks and icons
out("logo/dineri-mark.svg", svg(500, 600, markShapes(0, 0, 1), "Dineri"));
out("logo/dineri-mark-mono-ink.svg", svg(500, 600, markShapes(0, 0, 1, { line: null, fill: C.ink }), "Dineri"));
out("logo/dineri-mark-mono-ivory.svg", svg(500, 600, markShapes(0, 0, 1, { line: null, fill: C.ivory }), "Dineri"));
out("logo/dineri-app-icon.svg", svg(1024, 1024, appIconShapes(), "Dineri"));
out("logo/dineri-app-icon-maskable.svg", svg(1024, 1024, appIconShapes({ maskable: true }), "Dineri"));

// Wordmarks
out("logo/dineri-wordmark-on-dark.svg", svg(WORD_W, WORD_H, wordmarkShapes(C.ivory, C.red), "Dineri"));
out("logo/dineri-wordmark-on-light.svg", svg(WORD_W, WORD_H, wordmarkShapes(C.ink, C.red), "Dineri"));
out("logo/dineri-wordmark-mono-ink.svg", svg(WORD_W, WORD_H, wordmarkShapes(C.ink, C.ink), "Dineri"));
out("logo/dineri-wordmark-mono-ivory.svg", svg(WORD_W, WORD_H, wordmarkShapes(C.ivory, C.ivory), "Dineri"));

// Lockups: the app icon with the wordmark, side by side and stacked (the icon is 1.4 cap heights).
const ICON = Math.round(CAP * 1.4);
const GAP = Math.round(CAP * 0.45);
const iconAt = (x, y) => `<g transform="translate(${x} ${y}) scale(${ICON / 1024})">${appIconShapes()}</g>`;
for (const [name, text] of [
  ["on-dark", C.ivory],
  ["on-light", C.ink],
]) {
  const hw = ICON + GAP + WORD_W;
  out(`logo/dineri-lockup-horizontal-${name}.svg`, svg(hw, ICON, `${iconAt(0, 0)}<g transform="translate(${ICON + GAP} ${(ICON - CAP) / 2})">${wordmarkShapes(text, C.red)}</g>`, "Dineri"));
  const sw = Math.max(ICON, WORD_W);
  out(`logo/dineri-lockup-stacked-${name}.svg`, svg(sw, ICON + GAP + WORD_H, `${iconAt((sw - ICON) / 2, 0)}<g transform="translate(${(sw - WORD_W) / 2} ${ICON + GAP})">${wordmarkShapes(text, C.red)}</g>`, "Dineri"));
}

// ---------------------------------------------------------------- our own card art (for marketing)
/** An ivory playing card, 250 × 350, with a rank and a suit symbol (♦ ♥ red; ♠ ♣ ink). */
function cardFace(rank, suit) {
  const red = suit === "♦" || suit === "♥";
  const col = red ? C.red : C.ink;
  const big = suit === "♦" ? diamond(125, 175, 110, 132, col) : `<text x="125" y="215" font-size="130" text-anchor="middle" fill="${col}" font-family="serif">${suit}</text>`;
  return `<rect width="250" height="350" rx="18" fill="${C.ivory}"/><rect x="1.5" y="1.5" width="247" height="347" rx="17" fill="none" stroke="${C.ivoryLo}" stroke-width="3"/>
<g fill="${col}" font-family="Reem Kufi" font-weight="700"><text x="26" y="58" font-size="48" text-anchor="middle">${rank}</text><text x="224" y="292" font-size="48" text-anchor="middle" transform="rotate(180 224 280)">${rank}</text></g>
${suit === "♦" ? diamond(26, 88, 26, 32, col) + diamond(224, 262, 26, 32, col) : ""}${big}`;
}
/** A face-down card, 250 × 350: the eight-point-star back, as on the home page. */
function cardBack() {
  return `<defs><pattern id="stars" width="44" height="44" patternUnits="userSpaceOnUse"><g fill="none" stroke="#d9b35a" stroke-opacity=".5" stroke-width="2"><rect x="12" y="12" width="20" height="20"/><rect x="12" y="12" width="20" height="20" transform="rotate(45 22 22)"/></g></pattern></defs>
<rect width="250" height="350" rx="18" fill="${C.back}"/><rect width="250" height="350" rx="18" fill="url(#stars)"/>
<rect x="11" y="11" width="228" height="328" rx="12" fill="none" stroke="${C.brassHi}" stroke-opacity=".85" stroke-width="3"/>
<circle cx="125" cy="175" r="56" fill="${C.back}" stroke="${C.brassHi}" stroke-width="4"/><circle cx="125" cy="175" r="66" fill="none" stroke="${C.brassHi}" stroke-opacity=".5" stroke-width="2"/>
<g fill="${C.brassHi}"><rect x="100" y="150" width="50" height="50"/><rect x="100" y="150" width="50" height="50" transform="rotate(45 125 175)"/></g><circle cx="125" cy="175" r="12" fill="${C.back}"/>`;
}
const card = (x, y, rot, body) => `<g transform="translate(${x} ${y}) rotate(${rot} 125 350)" filter="url(#shadow)">${body}</g>`;

// ---------------------------------------------------------------- share image and avatar (rendered)
const fontFace = (family, file) =>
  `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${readFileSync(join(root, file)).toString("base64")}) format("woff2");font-weight:100 900;}`;
const FONTS =
  fontFace("Reem Kufi", "node_modules/@fontsource-variable/reem-kufi/files/reem-kufi-latin-wght-normal.woff2") +
  fontFace("Rubik", "node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2");
const shadowDef = `<defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-opacity=".45"/></filter></defs>`;

/** 1200 × 630: what a shared link shows (WhatsApp, Messenger, Facebook). */
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${shadowDef}
<defs><radialGradient id="lamp" cx="30%" cy="-5%" r="75%"><stop offset="0" stop-color="#ffba68" stop-opacity=".22"/><stop offset=".7" stop-color="#ffba68" stop-opacity="0"/></radialGradient>
<radialGradient id="felt" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${C.feltHi}"/><stop offset=".55" stop-color="${C.felt}"/><stop offset="1" stop-color="${C.feltLo}"/></radialGradient></defs>
<rect width="1200" height="630" fill="${C.night}"/><rect width="1200" height="630" fill="url(#lamp)"/>
<rect x="690" y="60" width="600" height="620" rx="60" fill="url(#felt)" stroke="${C.brass}" stroke-opacity=".6" stroke-width="6"/>
${card(752, 150, -16, cardBack())}${card(866, 130, -3, cardFace("A", "♦"))}${card(980, 150, 12, cardBack())}
<g transform="translate(80 160) scale(${104 / CAP})">${wordmarkShapes(C.ivory, C.red)}</g>
<text x="80" y="370" font-family="Reem Kufi" font-weight="600" font-size="62" fill="${C.ivory}">Deal in your friends.</text>
<text x="80" y="430" font-family="Rubik" font-size="28" fill="#a8b1bd">Tunisian card games, online. Play Trix</text>
<text x="80" y="468" font-family="Rubik" font-size="28" fill="#a8b1bd">with friends through a link, or against bots.</text>
<text x="80" y="560" font-family="Reem Kufi" font-weight="600" font-size="30" letter-spacing="3" fill="${C.brassHi}">DINERI.WORLD</text>
</svg>`;

/** 1024²: a profile picture for social accounts (the app icon, ready to crop to a circle). */
const avatar = svg(1024, 1024, appIconShapes({ maskable: true }), "Dineri");

// ---------------------------------------------------------------- write, render, lock
for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(here, path)), { recursive: true });
  writeFileSync(join(here, path), content);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
async function render(svgText, size, file, { transparent = false } = {}) {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>${FONTS}html,body{margin:0;background:transparent}svg{display:block;width:${w}px;height:${h}px}</style>${svgText}`);
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ omitBackground: transparent, type: "png" });
  await page.close();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  return buf;
}
const iconSvg = files["logo/dineri-app-icon.svg"];
const maskSvg = files["logo/dineri-app-icon-maskable.svg"];
for (const s of [16, 32, 48, 180, 192, 512, 1024]) await render(iconSvg, s, join(here, `png/dineri-app-icon-${s}.png`), { transparent: true });
await render(maskSvg, 512, join(here, "png/dineri-app-icon-maskable-512.png"));
await render(avatar, 1024, join(here, "png/dineri-social-avatar-1024.png"));
await render(og, [1200, 630], join(here, "png/dineri-share-1200x630.png"));
await render(files["logo/dineri-lockup-horizontal-on-dark.svg"].replace(/width="\d+" height="\d+"/, ""), [1600, Math.round((1600 * ICON) / (ICON + GAP + WORD_W))], join(here, "png/dineri-lockup-horizontal-on-dark.png"), { transparent: true });
await browser.close();

// The website's copies
mkdirSync(join(web, "icons"), { recursive: true });
writeFileSync(join(web, "favicon.svg"), iconSvg);
for (const s of [32, 180, 192, 512]) writeFileSync(join(web, `icons/icon-${s}.png`), readFileSync(join(here, `png/dineri-app-icon-${s}.png`)));
writeFileSync(join(web, "icons/icon-maskable-512.png"), readFileSync(join(here, "png/dineri-app-icon-maskable-512.png")));
writeFileSync(join(web, "og.png"), readFileSync(join(here, "png/dineri-share-1200x630.png")));
writeFileSync(
  join(web, "site.webmanifest"),
  JSON.stringify(
    {
      name: "Dineri",
      short_name: "Dineri",
      description: "Tunisian card games online: play with friends through a link, or against bots.",
      start_url: "/",
      display: "standalone",
      background_color: C.night,
      theme_color: C.night,
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  ) + "\n",
);

// The lock: every brand file and every website copy, fingerprinted.
const locked = [
  ...Object.keys(files).map((p) => join(here, p)),
  ...[16, 32, 48, 180, 192, 512, 1024].map((s) => join(here, `png/dineri-app-icon-${s}.png`)),
  ...["png/dineri-app-icon-maskable-512.png", "png/dineri-social-avatar-1024.png", "png/dineri-share-1200x630.png", "png/dineri-lockup-horizontal-on-dark.png", "tokens.css", "tokens.json"].map((p) => join(here, p)),
  ...["favicon.svg", "icons/icon-32.png", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "og.png", "site.webmanifest"].map((p) => join(web, p)),
];
const lock = Object.fromEntries(locked.map((f) => [relative(root, f), createHash("sha256").update(readFileSync(f)).digest("hex")]));
writeFileSync(join(here, "LOCK.json"), JSON.stringify({ note: "Dineri's locked brand assets (brand/BRAND.md). Change only with Seif's approval, then rebuild.", files: lock }, null, 2) + "\n");
console.log(`${Object.keys(lock).length} files built and locked`);
