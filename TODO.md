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
- [ ] **M1b Scaffold** (npm workspaces): `packages/engine`, `apps/server`, `apps/web`. `npm test` / `npm run build` / `npm run dev` all green.
- [ ] **M2 Engine** (test-first against RULES.md): a pure state machine, seeded deal, per-seat views, a test for every rule ID, the golden dineri round, and a fuzz test.
- [ ] **M3 Server + minimal web table:** room, invite link, name, seat, reconnect with the same seat, a WebSocket protocol where the server checks every move, and a plain UI.
- [ ] **M4 Visual rework:** a `<Card>` component drawing from Aisleriot `bonded.svg` (GPL-3+: include the notice), a layout that works on phones, animations. Our own cards later.
- [ ] **M5 Deploy:** Oracle machine, Node under systemd, Caddy for HTTPS, the domain.

## Lessons from the old code: the new engine must get these right
Found in the 2026-09-23 scan and smoke test of `archive/server-cpp` and `archive/client-sdl`. Each item becomes an engine or server test.
- Cards each player has taken must be cleared between rounds (the old code re-scored earlier rounds: `logic.hpp:31`).
- An early round ending (e.g. `ray` at K♥) must close out the trick cleanly. The old code left stale cards, counted K♥ twice, and left the clients stuck (`logic.hpp:201-209`).
- The server owns every hand and checks every move (the old server trusted the client; only the client enforced follow-suit).
- Bad input or a disconnect must never crash the server or other players. **Smoke test:** one closed window killed all 4 clients and the server.
- A dead connection must never be read as a move (the old server broadcast an empty contract, `game,`: `logic.hpp:123-133`).
- The `trix` contract must actually exist (the old code played it as ordinary tricks and scored 0).
- Contract names need one definition shared everywhere (`"Farcha"` vs `"farcha"` broke `general`).
- Scores and the winner must reach the players. The server must not exit after one game.
- Which contracts have been used is tracked by the server (the old code tracked it only in the client, via `available_games`).

Smoke test reference (2026-09-23), round 1 `dineri`: all 8 tricks were checked by hand. With 10 > K, the trick winners, who leads next, and the scores lam3i 0 / bochra 20 / ldhaw 50 / klafez 10 were all correct. This becomes a golden test once the rank order is confirmed.
Hands dealt: lam3i `k_h;k_c;8_c;k_d;a_s;10_s;9_s;7_s` · bochra `q_h;j_c;7_c;a_d;q_d;9_d;k_s;j_s` · ldhaw `a_h;10_h;j_h;q_c;10_d;j_d;8_d;8_s` · klafez `9_h;8_h;7_h;a_c;10_c;9_c;7_d;q_s`.
Tricks (leader first): K♦ Q♦ 10♦ 7♦ · 8♦ 9♥ K♥ A♦ · J♣ Q♣ 10♣ 8♣ · A♣ K♣ 7♣ 8♠ · 9♣ 10♠ 9♦ A♥ · 8♥ A♠ Q♥ 10♥ · J♥ 7♥ 9♠ K♠ · J♦ Q♠ 7♠ J♠.

## Open questions (for Seif)
- Approval of `RULES.md`, plus its remaining OPEN points (kicked player coming back; bot strategy in M3).
- M5: Oracle machine shape (ARM A1 / AMD micro) and OS; the domain name.
