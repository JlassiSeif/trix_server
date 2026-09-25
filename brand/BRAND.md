# Dineri: brand guide

**Status: LOCKED.** Approved by Seif on 2026-09-25 ("I really love the look… lock in the visual identity"). Nothing in this folder changes without Seif's OK (§9). The lock test (`brand/test/lock.test.ts`) fails if any logo, icon, token or website copy differs from its fingerprint in `LOCK.json`.

**Browsable version** (tokens, logos, components with previews, voice): the Dineri Design System at https://claude.ai/artifact/7YpxM6JghE9dAAL3WYciDp (private until Seif shares it). This file and the assets in this folder are the source; the browsable version is built from them.

## 1. The name
**Dineri** is Seif's hub for Tunisian card and table games, at **dineri.world**. It's named after *dineri*, the diamonds contract in Trix, and the red diamond is our mark.

- Always written **Dineri**: capital D, the rest lower case. Capitals only inside all-caps labels (DINERI.WORLD).
- Never Dinery, Dinari, DiNeRi, or with the diamond typed as a letter (Dineri♦ in running text).
- The games keep their own names (Trix, Chkobba…); Dineri is the place you play them.

## 2. The idea
**A card table on a Tunisian café night.** Everything comes from that scene:
- **The room:** midnight, lit by warm lamplight from above.
- **The table:** green felt with a brass rim. It's the stage for whatever matters on a page.
- **The cards:** ivory, with a red diamond. Games you can play lie **face up**; games not ready yet lie **face down**, their backs patterned with the **eight-point star**.

## 3. The logo system
The files are in `brand/logo/` (vector, letters outlined, so no font is needed) and `brand/png/` (rendered).

| Piece | File | Use |
|---|---|---|
| **App icon** | `dineri-app-icon.svg`, `png/dineri-app-icon-{16…1024}.png` | favicon, home-screen icon, app stores, anywhere square and small |
| **Maskable icon** | `dineri-app-icon-maskable.svg`, `png/…-maskable-512.png` | Android home screens (crops to a circle) |
| **Mark** | `dineri-mark.svg` (colour), `-mono-ink`, `-mono-ivory` | the diamond alone: a stamp, a bullet, a loading sign |
| **Wordmark** | `dineri-wordmark-on-dark.svg`, `-on-light.svg`, `-mono-ink`, `-mono-ivory` | the name on its own: headers, signatures |
| **Lockup, horizontal** | `dineri-lockup-horizontal-on-dark.svg`, `-on-light.svg` | the full logo: the site header, posters, video end cards |
| **Lockup, stacked** | `dineri-lockup-stacked-on-dark.svg`, `-on-light.svg` | square-ish spaces: a profile banner, merchandise |
| **Social avatar** | `png/dineri-social-avatar-1024.png` | profile picture on social networks |
| **Share image** | `png/dineri-share-1200x630.png` (and `/og.png` on the site) | what a shared link shows in WhatsApp, Messenger, Facebook |

**The wordmark:** "Dineri" in Reem Kufi SemiBold (600) with +0.02 em tracking, and a raised red diamond 60% of the cap height after it. It's a drawing, not text: always use the files and never retype it.

**Clear space:** keep empty space around any logo at least **half the height of the D**. Nothing (text, edges, other logos) goes inside it.

**Minimum sizes:** wordmark and lockups at least **80 px** wide on screen (20 mm in print); the app icon down to 16 px (it's drawn for that).

**Backgrounds:** on the midnight or felt colours, use *on-dark*; on ivory or white, *on-light*. On photos or busy images, use the mono ivory or mono ink version, whichever reads better.

**Never:**
- recolour any part, including the diamond;
- stretch, squash, rotate or skew;
- add shadows, glows, outlines or gradients;
- rebuild the wordmark in another font;
- change the diamond's shape or its place;
- put the red diamond on a red background (card backs included).

## 4. Colour
The source of truth is `tokens.css` (the website imports it), with `tokens.json` for everything else.

| Name | Hex | Role |
|---|---|---|
| Night | `#0f1722` | the room: page backgrounds. Most of any screen. |
| Night 2 | `#17212f` | raised surfaces on the night |
| Felt | `#0f4a33` (highlight `#16603f`, shadow `#0a3524`) | the table: the stage for what matters on a page |
| Brass | `#c9a04a` (light `#e6c46f`) | the table's rim, primary buttons, small highlights. Never large areas. |
| Ivory | `#f3ead8` (shade `#e3d6bc`) | cards, and light text on dark |
| Ink | `#1d1a15` | text on ivory |
| Dineri red | `#b8322b` | the mark, red suits, the one main action on a card ("Play Trix"). Sparingly. |
| Card back | `#7a1f26` | face-down cards only |
| Sky | `#1e5fa8` | Sidi Bou Said blue: only a faint glow in the room, never a fill |
| Lamp | `#ffba68` | only as warm light from above (a glow), never a fill |
| Text / dim text | `#efe7d6` / `#a8b1bd` | on night |

**Balance:** mostly night, one felt stage, ivory cards, brass and red as small accents.

## 5. Type
| Role | Typeface | Weights | Where |
|---|---|---|---|
| Display | **Reem Kufi** | 500–700 | the wordmark, headings, card names, all-caps labels |
| Text | **Rubik** | 400–600 | everything else: body text, buttons, forms |

- Both are free (SIL Open Font License), bundled with the site, and both cover **Latin and Arabic**, so English, French and Arabic pages use the same two typefaces. Reem Kufi was drawn from Kufic Arabic lettering; that's where Dineri's North African character in Latin comes from.
- All-caps labels get wide tracking (0.14–0.16 em) and are always small.
- Headings: large, tight line height, balanced line breaks.
- No other typefaces, anywhere.

## 6. Shapes and motifs
- **Playing cards:** 5 : 7, corner radius 16 px. **Face up = you can play it. Face down = coming.** Never use a face-up card for something unavailable.
- **The eight-point star** (two overlapping squares): the card-back pattern and ornaments. It's a common motif in Tunisian tiles and doors. Brass on card-back red, low contrast.
- **Diamonds as a scale:** difficulty and levels are ♦, ♦♦, ♦♦♦, in Dineri red.
- **The felt table:** a rounded panel with a brass rim, for the one group of things that matters on a page.
- **Motion:** cards lift slightly and straighten when pointed at; nothing else moves. Respect "reduce motion".

## 7. Voice and tone
**Like a friend dealing you in at a café table:** warm, playful, a little cheeky, always short.

| Do | Don't |
|---|---|
| Talk to a group of friends ("Send them a link") | Talk to a lone "user" |
| Name the games and their real rules | Vague "games" and "fun" |
| Keep it short: a headline, one line of detail | Paragraphs of marketing |
| Offer bots as the fallback ("Nobody around?") | Pretend bots are people |
| Use Derja lines written by Seif and his friends | Machine-written Derja, or clichés about Tunisia |
| Talk about playing, winning a game, bragging rights | **Gambling language: bet, stake, jackpot, casino, win money. Dineri is never about money.** |

**Our lines:**
- Headline: **Deal in your friends.**
- Descriptor: **Tunisian card games online.**
- Promise: **Play with friends through a link, or against bots, on a phone or a PC.**

**Messaging pillars:**
1. Your friends, one link away.
2. Tunisian games with their real rules.
3. Any phone or computer, nothing to install.
4. Bots when nobody's around.

**Invite message** (what a player sends; the site will prefill it): "Join my Trix table on Dineri: ‹link›"

**Languages:** English, French and Arabic. The same voice in each; the Arabic is right-to-left and uses the same typefaces. Translations are reviewed by Seif before they go live.

## 8. Where things live
- `brand/`: this guide, `tokens.css` / `tokens.json`, `logo/`, `png/`, `LOCK.json`, `build.mjs` (rebuilds everything), `tools/wordmark.py` (outlines the wordmark from the font).
- The website serves copies from `platform/web/public/`: `favicon.svg`, `icons/`, `og.png`, `site.webmanifest`. They're locked too.

## 9. Changing the brand
1. Seif approves the change, in words.
2. Change the source: `tokens.css` and `tokens.json` together, or `build.mjs`, or `tools/wordmark.py`.
3. Rebuild with `node brand/build.mjs`, which regenerates every file and rewrites `LOCK.json`.
4. Add a line to the changelog below: the date, what changed, and "approved by Seif".
5. Look at the results (`brand/png/`) before committing.

## Changelog
- 2026-09-25: first version, approved and locked by Seif.
