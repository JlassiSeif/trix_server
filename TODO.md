# Trix — TODO

We reconcile this file with the disk at the start of every session.
Sources of truth: the disk, Seif, and this file. Anything not written here or confirmed by Seif is an open question, not a decision.
The full plan behind the milestones below: `~/.claude/plans/shimmying-squishing-tarjan.md` (approved 2026-09-23).

## Goal
Play Trix online with friends: a web app hosted on Seif's free Oracle Cloud machine, served from Seif's domain.

## Decisions (confirmed by Seif)
- 2026-09-23: One git repo at `~/trix` (it keeps the old server's history). Heroku remote and `.vscode/` dropped.
- 2026-09-23: Baseline committed as `7aab93e` (the code as found, before any fixes). Not pushed.
- 2026-09-23: Stack is **TypeScript end to end**, with **React + Vite** for the web client. The old raw-TCP networking is dropped.
- 2026-09-23: The old code is reference only and lives in `archive/`: `server-cpp/`, `client-sdl/`, `cards/` (the prototype).
- 2026-09-23: First playable version: **one table for 4 friends**. Flow: a room with an invite link → pick a name → you're in.
- 2026-09-23: The look needs a complete rework. The card images currently come from Aisleriot (GNOME Solitaire), which is fine for now. Later we need our own card designs.
- 2026-09-23: **The rules walkthrough comes first.** No rule gets implemented unless it's in an approved `RULES.md`.

## Milestones
- [x] **M0 Housekeeping:** old code moved to `archive/`, `.gitignore` updated.
- [ ] **M1 Rules walkthrough → `RULES.md`.** One topic at a time, and every rule gets an ID (`R-…`). Done when Seif approves it.
  Seif's description is saved verbatim in `docs/rules-input.md`. The `RULES.md` draft was written 2026-09-23.
  1. [x] Deck and ranking
  2. [x] Seating, turn direction, dealing, who leads first
  3. [x] Contract structure, picker rotation, end of game, winner, result screen (loser shown first)
  4. [x] Each contract, including sweeps (150 instead of 80), ray declaration (−50 to the declarer, never multiplied), general (all 8 tricks → 0)
  5. [x] The `trix` contract
  6. [x] Legal plays
  7. [x] Table flow: automatic start, pause on disconnect, owner powers, kick, return, Ready to play again (open: can a kicked player come back?)
  8. [x] English; contract names unchanged
  9. [ ] Safe bot strategy: Claude drafts it in M3, Seif approves
  10. [ ] **Seif approves RULES.md**
- [x] **M1b Scaffold** (2026-09-23): npm workspaces `packages/engine`, `apps/server` (Node + `ws`, bundled with esbuild), `apps/web` (React 19 + Vite 8). TypeScript 7, Vitest 5, dependencies pinned exactly.
  Verified: `npm test`, `npm run typecheck` and `npm run build` are green. `npm start` serves the app, `/api/health`, the invite-link fallback `/r/<id>` and the WebSocket hello, and blocks path traversal. `npm run dev` does the same through Vite's forwarding to the server.
- [x] **M2 Engine** (2026-09-23), `packages/engine`: a pure state machine (`createGame`, `applyAction`, `legalActions`, `viewFor`) with a seeded deal and the placeholder bot.
  60 tests: every game rule ID in RULES.md is cited by a test (the `R-TABLE-*` rules are for M3), plus the golden smoke-test dineri round (0/20/50/10) and a fuzz test of 150 random games. The fuzz checks that all 32 cards are always accounted for, bad moves are rejected without changing the state, totals are consistent and every game ends.
  Measured coverage of the random games: forced trix without a jack, exact-1000 resets, ×4 forced picks, the declarer's −50, trix passes and ace extra turns, early endings, and both ways a game can end are all reached.
  Rules for which no player choice exists are applied automatically: in trix, a seat with no legal card passes automatically (R-TRIX-4), and a finished seat is skipped.
- [x] **Client baseline** (2026-09-23): 4 bots played a `dineri` contract on the old SDL client (`archive/client-sdl/tools/bot_driver.py`, Xephyr + XTEST). Screenshots and 28 observed behaviours (B-1 to B-28) are in `docs/client-baseline.md`.
- [ ] **Seif edits `docs/client-baseline.md`** with the behaviour he wants. The result becomes the spec for the web client.
- [x] **v0.5, playable with bots** (2026-09-23). Seif asked for it before the baseline edit, so M3 was pulled forward with a real UI rather than a plain one. Details under M3.
- [ ] **M3 Server + minimal web table:** room, invite link, name, seat, reconnect with the same seat, a WebSocket protocol where the server checks every move, and a plain UI.
  Status (v0.5): done. Room with an invite link, names, seats, bots in the lobby, automatic start, the server checking every move, rejoining with a seat token (a refresh keeps your seat), pause on disconnect with owner options (bot or end), kick and leave with a new link, score summary with Continue, game over with the loser first, and Ready to play again.
  Verified: 16 server tests (`apps/server/test`). `apps/web/e2e/play-vs-bots.mjs` plays a whole game in Chromium against 3 bots through the UI, with no browser errors, and includes a refresh mid-game and a phone-size screenshot.
  Design calls to confirm with Seif: click to play (no drag), you at the bottom with the next player on the right (counter-clockwise), the completed trick shown for 1.6 s with the winner highlighted, contract announcements as a banner, feed of events on the side, the scoreboard showing each player's contracts, R-TABLE-10 and R-TABLE-11.
- [ ] **M4 Visual rework:** a `<Card>` component drawing from Aisleriot `bonded.svg` (GPL-3+: include the notice), a layout that works on phones, animations. Our own cards later.
- [ ] **M5 Deploy:** Oracle machine, Node under systemd, Caddy for HTTPS, the domain.

## Lessons from the old code: the new engine must get these right
Found in the 2026-09-23 scan and smoke test of `archive/server-cpp` and `archive/client-sdl`. Each item becomes an engine or server test.
Status: the engine-side items (won piles reset every deal, early endings, the engine owns hands and validates every move, trix, a single contract list, used contracts tracked in state) are covered by M2 tests. The server-side items (disconnects, scores reaching players, not exiting after one game) belong to M3.
- Cards each player has taken must be cleared between rounds (the old code re-scored earlier rounds: `logic.hpp:31`).
- An early round ending (e.g. `ray` at K♥) must close out the trick cleanly. The old code left stale cards, counted K♥ twice, and left the clients stuck (`logic.hpp:201-209`).
- The server owns every hand and checks every move (the old server trusted the client; only the client enforced follow-suit).
- Bad input or a disconnect must never crash the server or other players. **Smoke test:** one closed window killed all 4 clients and the server.
- A dead connection must never be read as a move (the old server broadcast an empty contract, `game,`: `logic.hpp:123-133`).
- The `trix` contract must actually exist (the old code played it as ordinary tricks and scored 0).
- Contract names need one definition shared everywhere (`"Farcha"` vs `"farcha"` broke `general`).
- Scores and the winner must reach the players. The server must not exit after one game.
- Which contracts have been used is tracked by the server (the old code tracked it only in the client, via `available_games`).

Smoke test reference (2026-09-23), round 1 `dineri`: all 8 tricks were checked by hand. With 10 > K, the trick winners, who leads next, and the scores lam3i 0 / bochra 20 / ldhaw 50 / klafez 10 were all correct. The rank order is confirmed (R-DECK-2), so this is the golden test for M2. Under RULES.md it stays 0/20/50/10: the picker lam3i's ×2 applies to 0, and the last ♦ fell in the 8th trick, so no early ending (R-DIN-3).
Hands dealt: lam3i `k_h;k_c;8_c;k_d;a_s;10_s;9_s;7_s` · bochra `q_h;j_c;7_c;a_d;q_d;9_d;k_s;j_s` · ldhaw `a_h;10_h;j_h;q_c;10_d;j_d;8_d;8_s` · klafez `9_h;8_h;7_h;a_c;10_c;9_c;7_d;q_s`.
Tricks (leader first): K♦ Q♦ 10♦ 7♦ · 8♦ 9♥ K♥ A♦ · J♣ Q♣ 10♣ 8♣ · A♣ K♣ 7♣ 8♠ · 9♣ 10♠ 9♦ A♥ · 8♥ A♠ Q♥ 10♥ · J♥ 7♥ 9♠ K♠ · J♦ Q♠ 7♠ J♠.

## Open questions (for Seif)
- Between contracts: does the next deal come automatically after a few seconds on a score summary, or does it wait until all 4 click Continue?
- R-TRICK-6 assumptions: a look at the last trick is allowed at any moment (not only on your turn) and shows who played each card.
- M5: Oracle machine shape (ARM A1 / AMD micro) and OS; the domain name. The machine needs Node ≥ 22.12 (required by Vitest and Vite).
