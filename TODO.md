# Trix — TODO

We reconcile this file with the disk at the start of every session.
Sources of truth: the disk, Seif, and this file. Anything not written here or confirmed by Seif is an open question, not a decision.

## Goal
Play Trix online with friends: a web app hosted on Seif's free Oracle Cloud machine, served from Seif's domain.

## Open
1. **Push to GitHub:** blocked. This machine's key logs in as `Seifeddine-Jlassi`, which has no access to `JlassiSeif/trix_server`. Seif to choose: add a collaborator, add the key, or use a new repo.
2. **To confirm (not blocking).** These are Claude's design calls, in use since v0.5, which Seif played. RULES.md still marks them "Seif to confirm":
   - R-TABLE-10: the owner adds bots in the lobby, and a friend who joins later takes over a bot's seat.
   - R-TABLE-11: a score summary after each contract; the next deal starts when everyone clicks Continue, or after 10 s.
   - R-TRICK-6: a look at the last trick is allowed at any moment (not only on your turn) and shows who played each card.
   - Table layout: click to play (no drag); you at the bottom with the next player on your right (counter-clockwise); the finished trick shown for 1.8 s with the winner highlighted; contract announcements as a banner; the event feed; the leaderboard.
3. **`docs/client-baseline.md`:** Seif was going to mark the behaviour he wants from the old client. v0.5 has since replaced it as the working spec. Seif decides whether to drop this item.
4. **Later: our own card designs.** The cards are GNOME Aisleriot's "bonded" theme (GPL-3.0-or-later; the notice is in the README) and stay until we have our own.

## Next (Seif, 2026-09-24): the hub, personas, sounds
1. **Hub:** the site becomes a home for Tunisian games; each game has its own page with create table, play against bots and invite links. Trix is the first game; the others get added one by one, each with a rules walkthrough with Seif first.
2. **Personas for Trix:** Jeddi (sweet grandpa), Je7ch (the donkey), Chmeyti (playful opportunist), Waben (funny asshole), with chat bubbles. Spec draft `docs/personas.md`, waiting for Seif's approval. Lines from Seif and friends in `docs/persona-lines.csv`.
3. **Sounds, music, settings:** list and formats in `docs/sounds.md`; Seif provides the audio. Settings: music, sounds, memes, chat, and 18+ mode, which is off by default.
4. **Architecture and refactor (Seif, 2026-09-24, top priority):** prepare the codebase for many games, many players and frequent updates. Each game gets its own folder with its own rules, TODO, changelog, history and version, so it can be updated and rolled back on its own. Analysis and proposal: `docs/architecture.md`.
5. **Other games:** chkobba, rami, bent walad, loup garou, dominos, tehchi fih, an Uno-style game, a Monopoly-style game, jhayech, Pablo, the goose game.

## Platform roadmap (Seif, 2026-09-24): if this gets popular, this is where the value is
Applies to Trix, rami, chkobba and most card games.
- **Accounts:** play as a guest, then keep your progress with an account.
- **Player personas and voice lines:** more personas people can pick for themselves, and voice lines they trigger to talk to the table.
- **Customization:** card backs, card faces and shapes, table art, and each player's own corner of the table.
- **Ladders:** rankings per game, seasons.
- **Events:** tournaments where people win things (cosmetics, badges, sponsor prizes; never cash, which would be gambling law).
- **Monetization:** the customizations above as the main income, plus sponsorship (see the 2026-09-24 conversation).

## Done
- **M0 Housekeeping:** one repo at `~/trix`; the old C++ server and SDL client live in `archive/` as reference only; the Heroku remote and `.vscode/` are dropped. Baseline commit `7aab93e`.
- **M1 Rules:** `RULES.md` approved by Seif on 2026-09-23. Every rule has an ID, and tests cite those IDs. Bots are placeholders by decision (R-BOT-2). A player who leaves or is kicked can't reclaim their seat; a new invite link is generated (R-TABLE-6).
- **M1b Scaffold:** npm workspaces (engine, protocol, server, web, station), TypeScript end to end, React 19 + Vite, `ws`, and dependencies pinned exactly.
- **M2 Engine:** a pure, seeded state machine: 62 tests, including the golden dineri round from the old code (0/20/50/10) and a fuzz run of random games. Every bug found in the old code is covered by a test.
- **M3 Server + web table / v0.5** (tag `v0.5.0`): invite link, names, seats, bots, reconnecting with a seat token, pause on disconnect, kick and leave, score summary, game over, Ready to play again.
- **Look:** cards and contract icons from the repo's own assets, and a ranked leaderboard. It works on Seif's phone. Friends will play on PCs, so there's no deeper phone testing (Seif, 2026-09-23).
- **Testing station:** `npm run station`: 20 play scenarios plus 10 attack scenarios, an independent referee and a mutation check (7/7). See `docs/testing-station.md`.
- **Pre-deployment check:** `docs/predeploy-check.md`. Games survive restarts, a lost table is handled, two tabs can't fight over one seat, and there are caps plus security and cache headers.
- **Ownership (R-TABLE-12):** ownership passes on when the owner leaves or is away 30 s, and the owner can hand it over.
- **Security review:** `docs/security.md`. Per-address limits, a lockout on guessing, an origin check, unique names, HTTP hardening; npm audit clean.
- **Deployed (M5), 2026-09-24:** live at `https://trix.rheona.space`, a guest container on the shared Rheona VPS (`trix-web:fbbe767`), under the box's rules (`deploy/new_tenant.md`). `deploy/deploy.sh` does build, ship, prove on edge, validate + reload and post-checks; `docs/deploy.md` covers the rest. Verified live: a browser game over HTTPS/wss, security headers, real visitor addresses behind Caddy, 38 MB of the 128 MB cap, and the neighbours' post-checks green before and after.
- **Trix deadline (R-GAME-11), 2026-09-24:** Seif's rule change: trix must be picked by your 6th pick, so it can't be kept last to escape the ×4. Covered by engine tests, the random-games test, a station referee check and a new mutant (8/8 caught). The station now fails a stalled game at once instead of hanging, and reports server errors on moves.
- **Phone layout, 2026-09-24:** phones held upright (under 600 px) get a table that fits the screen with no scrolling, a contract list that leaves the hand visible, a hand sized to the width, and the leaderboard, feed and Leave behind a **Scores** button. Tablets keep full-size cards. A phone held sideways shows "Turn your phone upright". Checked with full games played through at 390×844 and 360×740 (`play-vs-bots.mjs --viewport`), plus desktop and the connection tests.
- **Bots, 2026-09-24** (spec `docs/bots.md`, approved by Seif): easy, medium and hard, deciding only from what a player in their seat could know. "Play against bots" on the first screen; the owner picks each bot's level in the lobby; stand-ins play at medium (RULES.md R-BOT-3, R-TABLE-13). Arena (`npm run arena`, `docs/bots-arena.md`): hard beats medium, medium beats easy, easy beats the old placeholder, all with clear margins; hard thinks 3 ms at the 99th percentile (budget 30 ms). Station S25 referees all three levels over a full game.
- **Abandoned tables, 2026-09-24:** at the 5-tables-per-address limit, a table nobody is connected to makes way for the new one (Seif approved). The 6-hour cleanup stays.
- **Deployed 2026-09-24 (`trix-web:dce18c0`):** the bots with levels, Play against bots, the phone layout, the trix deadline (R-GAME-11) and abandoned-table recycling are live at https://trix.rheona.space. Neighbours' post-checks green before and after; live check: a browser game against three hard bots, no page or bot errors; 4 saved tables restored across the restart; 45 MB of 128 MB. Rollback: `trix-web:prev` (fbbe767).
- **Last full check (2026-09-24, before the bots deploy):** unit tests 125/125 (79 engine, 46 server), typecheck and build clean, station 31/31, mutation check 8/8, browser connection tests 16/16, a full game in the browser at desktop and phone size, arena all checks passed.
