# Dineri (the Tunisian games hub): TODO

The platform's list, and the index of games. Each game keeps its own list in `games/<game>/TODO.md`. We reconcile these files with the disk at the start of every session. Sources of truth: the disk, Seif, and these files. Anything not written here or confirmed by Seif is an open question, not a decision.

## Goal
A home for Tunisian card and table games, played with friends or against bots, at **https://dineri.world** (`www.dineri.world` and the old `trix.rheona.space` redirect to it). If it gets popular: accounts, customization, ladders and events (Roadmap).

## Games

| Game | Status | Folder | Version |
|---|---|---|---|
| Trix | Live | [games/trix](games/trix) ([TODO](games/trix/TODO.md), [CHANGELOG](games/trix/CHANGELOG.md)) | 1.1.0 |
| Chkobba, rami, bent walad, loup garou, dominos, tekdheb, an Uno-style game, a Monopoly-style game, jhayech, Pablo, the goose game | Wanted (Seif's friends, 2026-09-24); each starts with a rules walkthrough with Seif | | |

Adding a game: [docs/adding-a-game.md](docs/adding-a-game.md). How games look: [docs/game-look.md](docs/game-look.md).

## Open
1. **Accounts: Seif's steps in the Firebase console** (project `dineri-world`). Stays here until Seif says (2026-09-25). The code is built and tested against the emulators; until these are done the live site simply has no sign-in.
   1. **Firestore:** Build → Firestore Database → Create database → location **europe-west3 (Frankfurt)** → production mode. Then deploy the rules: `firebase deploy --only firestore:rules --project dineri-world` (they deny all browser access; the server has its own key).
   2. **Authentication:** Build → Authentication → Get started. Sign-in method: enable **Google** (pick the support email) and **Email/Password** with **Email link (passwordless sign-in)** switched on.
   3. **Authorized domains** (Authentication → Settings): add `dineri.world`.
   4. **Google sign-in under our own name:** Google Cloud console → APIs & Services → Credentials → the "Web client (auto created by Google Service)" → Authorized redirect URIs: add `https://dineri.world/__/auth/handler` (Caddy passes `/__/` to Firebase).
   5. **The server's key:** Project settings → Service accounts → Generate new private key; save it as `~/trix/.secrets/firebase-sa.json` on this machine (never in git; `deploy.sh` ships it to the box, owner-only). Then a deploy turns sign-in on.
2. **Seif to review, before Dineri opens to everyone:**
   1. The **French and Arabic** wording (hub pages: `platform/web/src/text.ts`; the Trix table: `games/trix/ui/src/text.ts`; shared bits: `platform/ui/src`). Open questions in Arabic: should "Dineri" have an Arabic spelling (the brand only has the Latin one, so the Arabic pages keep it in Latin letters)? Arabic-script names for the games and contracts, or keep them in Latin letters as now? Card words: a trick is "أكلة", a jack "J", a queen "Q".
   2. The **Privacy** and **Terms** pages (drafts, marked as such on the page) and **About**.
   3. A **contact email** for those pages (they say "an address is coming soon").
3. **Architecture phase 2, fun for every game:** a settings panel (sounds, memes, music, bot chat, 18+ mode off by default), the sound system, chat bubbles and personas. Trix's content: `games/trix/TODO.md`.
4. **Own machine before going public** (architecture §11). Which machine? Seif's Oracle free account?
5. **Dineri's own card faces** (Seif, 2026-09-25: later). Trix uses GNOME Aisleriot's faces (GPL, credited on the About page and in the README).
6. **Platform station:** the testing station lives in `games/trix/station`. Its game-independent parts (simulated players, attack scenarios) move to `platform/station` when the second game arrives.

## Roadmap (Seif, 2026-09-24): if this gets popular, this is where the value is
The phases are in [docs/architecture.md](docs/architecture.md) §13. Applies to Trix, rami, chkobba and most card games.
- **Accounts:** play as a guest, then keep your progress with an account (built 2026-09-25; waiting on Open 1).
- **Player personas and voice lines:** personas people pick for themselves, and voice lines they trigger to talk to the table.
- **Customization:** card backs, card faces and shapes, table art, and each player's own corner of the table.
- **Ladders:** rankings per game, seasons.
- **Events:** tournaments where people win things (cosmetics, badges, sponsor prizes; never cash, which would be gambling law).
- **Monetization:** the customizations above as the main income, plus sponsorship (see the 2026-09-24 conversation).

## Deployed
- **2026-09-25: `fe275c1`, the switch-over to https://dineri.world** (Seif: "deploy to the new link"). Live: the Dineri hub and brand, Trix 1.1.0 (three languages, the house style, drag and drop and premoves), accounts code (sign-in off until Open 1 is done), About/Privacy/Terms, 404. `www.dineri.world` and `trix.rheona.space` redirect with their paths (invite links keep working). Verified: the full gate on the release commit (unit tests, typecheck, build, station 31/31, mutants 8/8, arena, browser flows 17/17, full games at desktop and phone size); the image smoke-tested locally; post-checks (neighbours registry 401, license 404, install.sh 200; hub 200, API 200, `/__/auth/handler` 200, both redirects 301); a live browser game at desktop and phone size with no page errors; the server healthy at 36 MB of 128, no published port. Zero tables were in play at the switch. Previous release kept as `trix-web:prev`. The first build failed (the Dockerfile didn't include the brand yet), fixed in `fe275c1` before anything was shipped.
- **2026-09-24:** `fbbe767` (first deploy, trix.rheona.space), then `dce18c0` (bots at three levels, the phone layout).

## Done (platform)
- **Repository and GitHub:** one repo at `~/trix` (the 2023 C++ server and SDL client in `archive/`, reference only; baseline `7aab93e`), pushed to `JlassiSeif/trix_server` with release tags. This machine pushes with its own key, `~/.ssh/trix_github`, set for this repo only (`git config core.sshCommand`).
- **Architecture phase 1 (2026-09-25):** `docs/architecture.md` approved by Seif (one repository with a folder per game). The platform (`platform/`) runs any game through the game contract (`platform/sdk`); Trix is `games/trix`. Hub home page, a page per game, per-game off switch (`TRIX_CLOSED_GAMES`), `GET /api/games`, per-game TODO, changelog and version. A test-only second game proves the platform doesn't depend on Trix.
- **The name and the brand (2026-09-25):** the hub is **Dineri** at **dineri.world** (DNS at Namecheap, verified; Seif approved serving it from the Rheona box, as the owner of both). The brand is locked (`brand/BRAND.md`, logos, tokens, icons, share image, a lock test) and the hub's look follows it: a card table on a Tunisian café night.
- **How games look (2026-09-25):** `docs/game-look.md`, approved by Seif ("one house, many rooms"). The shared kit (`platform/ui`) draws in the brand's style and provides the seat tag, Dineri's card back and the table header; a test fails on colours or fonts from outside the brand. The Trix table follows it.
- **Accounts and languages (2026-09-25):** Firebase Authentication (Google, email link), optional, with profiles in Firestore written only by the server (token checks and database calls without the Firebase Admin library, to stay inside 128 MB). Sign-in window, `/signin`, an account page (name, language, sign out, delete everything). English, French and Arabic (right to left) across the hub and the Trix table; the account's language follows you. A signed-in player's seat remembers their account. Footer, About, Privacy and Terms (drafts), a 404 page, robots.txt and sitemap. Guests never download Firebase's code. Tests: `npm run test:accounts` (emulators) and `platform/web/e2e/accounts.mjs` (27 browser checks).
- **Security review:** `docs/security.md`. Per-address limits, a lockout on guessing, an origin check, unique names, HTTP hardening, sign-in tokens checked on the server, the database closed to browsers; npm audit clean.
- **Pre-deployment check:** `docs/predeploy-check.md`. Games survive restarts, lost tables are handled, two tabs can't fight over one seat, caps plus security and cache headers.
- **Hosting:** a guest container on the shared Rheona VPS, under the box's rules (`deploy/new_tenant.md`). `deploy/deploy.sh` builds, ships, proves the container, reloads Caddy only when needed and runs the post-checks; `docs/deploy.md` covers the rest.
- **Smaller things:** abandoned tables make way at the 5-tables-per-address limit (2026-09-24); "Tehchi fih" is now **Tekdheb** on the coming-soon list (Seif, 2026-09-25).
- **Last full check (2026-09-25, premoves):** unit tests 153/153 plus 3 against the emulators, typecheck and build clean, browser flows 17/17, premove flow 10/10 at three sizes, full games against bots at desktop and phone size. Accounts flow 27/27 and station 31/31 as of the house-style and accounts checks earlier the same day (neither changed since).
