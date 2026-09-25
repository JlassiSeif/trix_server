# Dineri (the Tunisian games hub): TODO

The platform's list, and the index of games. Each game keeps its own list in `games/<game>/TODO.md`. We reconcile these files with the disk at the start of every session. Sources of truth: the disk, Seif, and these files. Anything not written here or confirmed by Seif is an open question, not a decision.

## Goal
A home for Tunisian card and table games, played with friends or against bots, at https://dineri.world (live today at https://trix.rheona.space until the next deploy). If it gets popular: accounts, customization, ladders and events (below).

## Games

| Game | Status | Folder | Version |
|---|---|---|---|
| Trix | Live | [games/trix](games/trix) ([TODO](games/trix/TODO.md)) | 1.0.0 |
| Chkobba, rami, bent walad, loup garou, dominos, tehchi fih, an Uno-style game, a Monopoly-style game, jhayech, Pablo, the goose game | Wanted (Seif's friends, 2026-09-24); each starts with a rules walkthrough with Seif | | |

Adding a game: [docs/adding-a-game.md](docs/adding-a-game.md).

## Open
1. **Deploy the restructure** (architecture phase 1, built 2026-09-25): waiting for Seif to try it.
2. **Architecture phase 2, fun for every game:** a settings panel (sounds, memes, music, bot chat, 18+ mode off by default), the sound system, chat bubbles and personas. Trix's content: `games/trix/TODO.md`.
3. **Own machine before going public** (architecture §11). Which machine? Seif's Oracle free account?
4. **Dineri at dineri.world** (Seif, 2026-09-25): the hub's name is **Dineri** and its address **dineri.world**, with www and trix.rheona.space redirecting to it. Deploy files are ready; Seif sets the DNS at Namecheap (A `@` → 158.180.55.44, CNAME `www` → dineri.world, parking records removed, no AAAA). The switch-over happens with the next deploy Seif calls, at a quiet moment. DNS set by Seif and verified (2026-09-25); Seif approved serving dineri.world from the Rheona box (he owns both).
5. **Accounts: Seif's steps in the Firebase console** (project `dineri-world`). The code is built and tested against the emulators; the real project needs:
   1. **Firestore:** Build → Firestore Database → Create database → location **europe-west3 (Frankfurt)** → production mode. Then deploy the rules: `firebase deploy --only firestore:rules --project dineri-world` (they deny all browser access; the server has its own key).
   2. **Authentication:** Build → Authentication → Get started. Sign-in method: enable **Google** (pick the support email) and **Email/Password** with **Email link (passwordless sign-in)** switched on.
   3. **Authorized domains** (Authentication → Settings): add `dineri.world`.
   4. **Google sign-in under our own name:** Google Cloud console → APIs & Services → Credentials → the "Web client (auto created by Google Service)" → Authorized redirect URIs: add `https://dineri.world/__/auth/handler` (Caddy passes `/__/` to Firebase).
   5. **The server's key:** Project settings → Service accounts → Generate new private key; save it as `~/trix/.secrets/firebase-sa.json` on this machine (never in git; `deploy.sh` ships it to the box, owner-only).
   Until then the live site simply has no sign-in.
6. **Seif to review, before Dineri opens to everyone:**
   1. The **French and Arabic** wording (hub pages: `platform/web/src/text.ts`; the Trix table: `games/trix/ui/src/text.ts`; shared bits: `platform/ui/src`). Open questions in Arabic: should "Dineri" have an Arabic spelling (the brand only has the Latin one, so the Arabic pages keep it in Latin letters)? Arabic-script names for the games and contracts, or keep them in Latin letters as now? Card words: a trick is "أكلة", a jack "J", a queen "Q".
   2. The **Privacy** and **Terms** pages (drafts, marked as such on the page) and **About**.
   3. A **contact email** for those pages (they say "an address is coming soon").
7. **Dineri's own card faces** (Seif, 2026-09-25: later). Trix uses GNOME Aisleriot's faces (GPL, credited on the About page and in the README); a design task for when we get to it.
8. **Platform station:** the testing station lives in `games/trix/station`. Its game-independent parts (simulated players, attack scenarios) move to `platform/station` when the second game arrives.

## Roadmap (Seif, 2026-09-24): if this gets popular, this is where the value is
The phases are in [docs/architecture.md](docs/architecture.md) §13. Applies to Trix, rami, chkobba and most card games.
- **Accounts:** play as a guest, then keep your progress with an account.
- **Player personas and voice lines:** personas people pick for themselves, and voice lines they trigger to talk to the table.
- **Customization:** card backs, card faces and shapes, table art, and each player's own corner of the table.
- **Ladders:** rankings per game, seasons.
- **Events:** tournaments where people win things (cosmetics, badges, sponsor prizes; never cash, which would be gambling law).
- **Monetization:** the customizations above as the main income, plus sponsorship (see the 2026-09-24 conversation).

## Done (platform)
- **Repository:** one repo at `~/trix`; the 2023 C++ server and SDL client live in `archive/` as reference only. Baseline commit `7aab93e`.
- **GitHub (2026-09-25):** pushed to `JlassiSeif/trix_server` with the release tags (`v0.5.0`, `trix@1.0.0`, `platform@1.0.0`). This machine pushes with its own key, `~/.ssh/trix_github` (a deploy key with write access), set for this repo only (`git config core.sshCommand`). Automated tests and deploys (architecture phase 4) can build on it.
- **Architecture phase 1 (2026-09-25):** `docs/architecture.md` approved by Seif (one repository with a folder per game; restructure first). The platform (`platform/`) runs any game through the game contract (`platform/sdk`); Trix is `games/trix`. Hub home page, a page per game, per-game off switch (`TRIX_CLOSED_GAMES`), `GET /api/games`, per-game TODO, changelog and version. A test-only second game proves the platform doesn't depend on Trix.
- **Dineri's look (2026-09-25):** the hub is a card table on a Tunisian café night: playable games are face-up cards, the rest lie face down; Reem Kufi and Rubik; the game page and lobby to match. Checked at desktop and phone size (`platform/web/e2e/look.mjs`). Not deployed (deploys happen at milestones Seif calls).
- **Security review:** `docs/security.md`. Per-address limits, a lockout on guessing, an origin check, unique names, HTTP hardening; npm audit clean.
- **Pre-deployment check:** `docs/predeploy-check.md`. Games survive restarts, lost tables are handled, two tabs can't fight over one seat, caps plus security and cache headers.
- **Hosting:** a guest container on the shared Rheona VPS, under the box's rules (`deploy/new_tenant.md`). `deploy/deploy.sh` builds, ships, proves the container, reloads Caddy only when needed and runs the post-checks; `docs/deploy.md` covers the rest. Live releases: `fbbe767` and `dce18c0` (2026-09-24).
- **Abandoned tables (2026-09-24):** at the 5-tables-per-address limit, a table nobody is connected to makes way for the new one. The 6-hour cleanup stays.
- **How games look (2026-09-25, not deployed):** `docs/game-look.md` approved by Seif ("one house, many rooms": the frame, type, colours, controls, panels, seats and card backs are shared; each game owns its surface, pieces, one accent and its icons). The kit (`platform/ui`) now draws in the brand's style and provides the seat tag, Dineri's card back and the table header (Dineri's name and the language menu at the table). A test (`platform/ui/test/look.test.ts`) fails on colours or fonts from outside the brand; it failed on the old Trix stylesheet and passes on the new one. The Trix table re-dressed to it.
- **Accounts and languages (2026-09-25, not deployed):** Firebase Authentication (Google, email link), optional, with profiles in Firestore written only by the server (token checks and database calls without the Firebase Admin library, to stay inside 128 MB). Sign-in window, `/signin` for email links, an account page (name at the table, language, sign out, delete everything). English, French and Arabic (right to left) across the hub and the Trix table, with a language menu; the account's language follows you. A signed-in player's seat remembers their account. Footer, About, Privacy and Terms (drafts), a 404 page, robots.txt and sitemap. Firebase's browser code loads only for people who sign in. Deploy files ready: the key as a mounted secret, Caddy passes `/__/` to Firebase, a post-check for it. Tests: server unit tests, the emulator integration test (`npm run test:accounts`), and `platform/web/e2e/accounts.mjs` (27 checks in a browser: languages, email link, Google, account edit, name at the table, delete), with screenshots in all three languages at desktop and phone size.
- **Last full check (2026-09-25, house style):** unit tests 153/153 (including the new look test, which failed on the old Trix stylesheet) plus 3 against the emulators, typecheck and build clean, browser flows 17/17, accounts flow 27/27, full games against bots at 1280×800, 390×844 and 360×740, the Arabic table checked. Station not rerun (the server did not change).
- **Earlier full check (2026-09-25, the restructured hub):** unit tests 129/129 (79 Trix, 50 platform, including a test-only second game), typecheck and build clean, station 31/31, mutation check 8/8, arena (hard > medium > easy, same results as before the move), browser flows 17/17, full games at desktop and phone size, the deploy image builds and serves /, /trix and /api/games.
