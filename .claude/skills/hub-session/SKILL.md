---
name: hub-session
description: Start-of-session routine and standing rules for the Tunisian games hub repo (~/trix, live at trix.rheona.space). Use at the start of EVERY session in this repo, when Seif asks where things stand, and when updating or reconciling the TODO lists (root TODO.md, games/<game>/TODO.md). Covers the working agreement with Seif, the repo map, which checks to run for which change, and the traps already paid for.
---

# Tunisian games hub: session routine

Seif owns this project. He's the product owner and the source of the rules; Claude builds, tests and deploys. The site started as a revival of Seif's 2023 Trix game and became a hub for Tunisian card and table games (docs/architecture.md).

## 1. The working agreement (from day one, never relax it)
- **Sources of truth:** the disk, Seif, and the TODO lists. Nothing else. Verify on disk before claiming anything.
- **Never invent rules or behaviour.** Tunisian games have regional variants; the rules come from Seif. Ask when anything is ambiguous (AskUserQuestion when it blocks work).
- **Specs before code.** Rules, bot behaviour, personas and architecture are written as a document (DRAFT for Seif), and approved by Seif before anything is built (status line: APPROVED by Seif, date). Changes after approval need his OK and a dated changelog line. Examples: `games/trix/RULES.md`, `games/trix/docs/bots.md`, `docs/architecture.md`.
- **The brand is locked** (`brand/BRAND.md`, Seif 2026-09-25): logos, colours, typefaces, motifs and voice. Use the tokens and files; never alter them without Seif's words, then rebuild (`node brand/build.mjs`). The lock test fails on any unapproved change.
- **Approval doesn't carry over.** "Deploy" once isn't "deploy" forever; each deploy needs Seif's go (see the hub-deploy skill).
- **Say what's true.** Report failures with their output, say what was skipped, never claim a check that didn't run. A check that can't fail is not a check: make sure each new test could fail (the mutation check exists for this).

## 2. Start of session (do all of it, then report in a few lines)
1. Read `TODO.md` (platform list, games index, roadmap) and every `games/*/TODO.md`.
2. Reconcile with the disk:
   ```bash
   git status --short && git log --oneline -15 && git tag -l | tail
   ```
   Anything done on disk but still open in a TODO (or the reverse)? Fix the TODO, or ask Seif if it's unclear.
3. The live site: `curl -s https://trix.rheona.space/api/health` shows the game versions running. Compare with the TODO's "Deployed" entries and the tags.
4. Leftovers from earlier sessions, which have made Seif's PC fan roar before:
   ```bash
   ps -eo pid,pcpu,etime,comm,args --sort=-pcpu | awk '$4=="MainThread" || /tsx|chrom/' | head
   ss -ltnp | grep -E ':(8123|8124|18080|18090|18181) '
   docker ps --format '{{.Names}}' | grep -E 'trix-local|hub-test'
   ```
   Kill only our own leftovers, by exact PID. Node processes show their comm as `MainThread`. Seif's other Node processes (his MCP supervisors) and Docker containers (gitlab-runner, buildx_buildkit_rheonix0) are not ours: leave them alone.
5. Tell Seif briefly: what's live, what's open, what's waiting on him.

## 3. Updating the TODOs
- **Root `TODO.md`:** the platform (server, web shell, hosting, accounts…), the games index table, the roadmap, "Done (platform)", and one "Last full check" line.
- **`games/<game>/TODO.md`:** that game only. Its history by version goes in `games/<game>/CHANGELOG.md`.
- A Done entry says what was done, when (absolute date), and how it was verified, with real numbers ("station 31/31, browser flows 17/17"). Replace the "Last full check" line rather than stacking new ones.
- Record Seif's decisions with the date and his words ("Seif, 2026-09-24"). Anything he hasn't decided stays under Open, phrased as a question for him.
- Commit TODO changes on their own, with the attribution line from the system prompt.
- **Push after committing** (`git push origin master`, and `git push origin <tag>` for new release tags): GitHub (`JlassiSeif/trix_server`) is the off-machine copy. This repo pushes with its own key, `~/.ssh/trix_github` (set in `git config core.sshCommand`).

## 4. Repo map
| Where | What |
|---|---|
| `platform/sdk` | The game contract (GameModule): what a game provides so the platform can run it |
| `platform/server` | Rooms, seats, invites, reconnects, bot scheduling, persistence, security. Knows no game |
| `platform/protocol`, `platform/ui`, `platform/web` | Messages; the shared screen kit (connection, languages `i18n.ts`, server error lines `errors.ts`); the hub site (home, game pages, lobby, sign-in, account, about/privacy/terms, 404) |
| `platform/server/src/accounts`, `platform/web/src/account.ts`, `firebase/` | Accounts (Firebase project `dineri-world`): token checks, Firestore over REST, the browser side, emulator config and database rules. `docs/architecture.md` §6–7 |
| `games/trix` | Trix: `engine/` (rules, bots, module.ts), `ui/`, `station/` (station, arena, mutants), `docs/`, RULES/TODO/CHANGELOG |
| `deploy/` | Dockerfile, compose.yml, trix.caddy, deploy.sh. `deploy/new_tenant.md` is the Rheona box owner's rules: git-excluded, never commit it |
| `brand/` | Dineri's locked identity: BRAND.md, tokens, logos, icons, share image, LOCK.json |
| `docs/` | architecture, adding-a-game, game-look (how games look), deploy, security, predeploy-check |
| `archive/` | The 2023 C++/SDL code: reference only |

Adding a game follows `docs/adding-a-game.md`, starting with a rules walkthrough with Seif.

## 5. Which checks for which change
| Change | Run |
|---|---|
| Any | `npm test && npm run typecheck && npm run build` |
| A game's rules | engine tests citing rule IDs; `npm run station`; `npx tsx games/trix/station/src/mutants.ts` (all caught) |
| Bots | `npm run arena` (every level clearly beats the one below; hard under 30 ms at the 99th percentile) |
| Server or contract | server tests (including `test/contract.test.ts`, the test-only second game); the station |
| Screens | `node platform/web/e2e/connections.mjs`; a full game: `TRIX_SPEED=10 PORT=8123 node platform/server/dist/index.js` then `node platform/web/e2e/play-vs-bots.mjs OUT --viewport 390x844` (and 360x740, and desktop) |
| Accounts or languages | `npm run test:accounts` (the emulators start and stop around it); for the browser flow run `npm run emulators` and a server against them (see the header of `platform/web/e2e/accounts.mjs`), then `node platform/web/e2e/accounts.mjs OUT --state <rooms file>`: it screenshots every new page in all three languages at both sizes. Read them. |
| How anything looks | **Look before handing it over.** `node platform/web/e2e/look.mjs OUT --base URL --tag before` (hub pages at desktop and phone size), change, `--tag after`, then read the screenshots and judge them honestly. Seif caught a plain first version of the hub that nobody had looked at. |
| Before a deploy | all of the above (the hub-deploy skill) |

Run long suites in the background and wait for the notification; don't poll.

## 6. Traps already paid for
- **`pkill -f` kills your own shell** (exit 144) when the pattern appears in your own command line. Find the PID with `ps -eo pid,ppid,comm,args` and kill that PID.
- **Killed test runs leave servers behind.** The station now stops its server on exit, but always check for leftovers after a timeout or a kill.
- **Local tests share one address,** and the server allows 5 tables per address. After 5 test tables it refuses (TOO_MANY_TABLES): restart the local server, or give each browser its own X-Forwarded-For with `TRIX_TRUST_PROXY=1` (connections.mjs does this).
- **Behind Caddy on Docker,** the server trusts X-Forwarded-For only with `TRIX_TRUST_PROXY=private`; otherwise every player looks like one address.
- **Browser storage keys keep the `trix.` prefix** (`trix.seat.<room>`, `trix.name`): renaming them would throw players out of their seats.
- **Bots never see the game state:** only their view and the round's public events (the tests enforce it). The engine stays free of Node and React. Bot code must never end up in the browser bundle (the engine is marked side-effect free; heavy bot tables are computed lazily).
- **Vite inlines small images into scripts** unless `assetsInlineLimit: 0`; keep art as real files.
- **Phones:** checked with browser viewport screenshots (390×844, 360×740). Seif stopped deeper phone testing; no device simulation. A phone held sideways shows "Turn your phone upright".
- **One house, many rooms** (`docs/game-look.md`, approved 2026-09-25): games draw with the kit (`platform/ui`: controls, panels, `SeatTag`, `cardBackUrl`, `<TableHeader />`) and the brand's tokens and fonts only; `platform/ui/test/look.test.ts` fails otherwise. Kit buttons glow brass by default: quiet ones need `box-shadow: none`. Reem Kufi's "1" looks like an "l" at small sizes: small numbers use Rubik.
- **Every word on screen lives in a catalog** (`texts({ en, fr, ar })`): the type checker refuses a language that misses a line. French and Arabic are drafts until Seif reviews them; never write Derja for him. Game and contract names, and the name Dineri, stay in Latin letters in Arabic until Seif decides otherwise.
- **Arabic, right to left:** the page flips (`<html dir="rtl">`), the card table does not (`dir="ltr"` on the felt, so seats go round the same way). Wrap signed numbers ("+10", "×2", "=1") in `ltr()` or they come out as "10+". No letter-spacing or capitals on Arabic text.
- **Accounts stay optional and light:** guests must never download Firebase (accounts.mjs checks it). Never show Firebase's own error messages; map codes to lines in the catalog.
- **The Firestore emulator needs Java 21;** this machine has 17, so `firebase/emulators.sh` uses a portable runtime in `~/.cache/jdk21` (Temurin 21 JRE, downloaded 2026-09-25). The emulators use the project `demo-dineri`, which can never reach the real one.
- **Commits touch one game's folder or the platform, never both,** so `git log -- games/<game>` is that game's history. End commit messages with the attribution line the system prompt gives.

## 7. Talking to Seif
- Plain language: what it does for players, not implementation details. Short reports; lead with what he must decide or do.
- Blocking decisions: AskUserQuestion with a recommended option. Non-blocking: list them under Open.
- He can't be emailed from this machine (no mail setup). For reports he'll read later: a published Artifact page, plus PushNotification (it only reaches his phone when Remote Control is on).
- Content he provides (persona lines in Derja, audio, rules) is his; never write Derja jokes or rules on his behalf.
