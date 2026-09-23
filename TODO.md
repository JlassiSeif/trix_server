# Trix — TODO

We reconcile this file with the disk at the start of every session.
Sources of truth: the disk, Seif, and this file. Anything not written here or confirmed by Seif is an open question, not a decision.

## Goal
Play Trix online with friends: a web app hosted on Seif's free Oracle Cloud machine, served from Seif's domain.

## Decisions (confirmed by Seif)
- 2026-09-23: Layout is `server/`, `client-sdl/`, `archive/`, with one git repo at `~/trix` (keeps the server history).
- 2026-09-23: `cards/` prototype archived to `archive/cards/`.
- 2026-09-23: Heroku remote dropped. `.vscode/` folders dropped.
- 2026-09-23: The old raw-TCP networking is to be dropped. The end product is a web app.
- 2026-09-23: Order of work: **fix the game loop → fix the look → make it a web app → host on Oracle + domain.**

## Now
- [x] Smoke test (2026-09-23): server + 4 × `client-sdl/prog` locally, logs in the session scratchpad.
  - Round 1 `dineri` played correctly. All 8 tricks were checked by hand: trick winners (with 10 > K), who leads next, and scores (0/20/50/10) are all correct.
  - Round 2 collapsed: bochra's client exited at the contract picker (Seif closed the window on purpose, confirmed). The server then broadcast `game,` with an empty name, the other 3 clients segfaulted on it (`graphics.h:485` reads `p[1]` without checking it exists), and the server died without a message (most likely SIGPIPE).
- [ ] Seif walks through the rules (see Open questions). Nothing rule-related gets fixed before this.

## Next: game loop (server, `server/src/logic.hpp`)
Bugs found in the scan (2026-09-23), independent of the rules:
- [ ] Cards each player has taken are never cleared between rounds, so every round re-scores earlier rounds (`logic.hpp:31`).
- [ ] When `ray` ends early at K♥: the played cards aren't cleared and `end_of_pli` isn't sent. The next trick then uses stale cards, and K♥ is counted again (`logic.hpp:201-209`).
- [ ] The server never tracks hands and never validates a played card (whether it's in the hand, whether it follows suit). Only the client enforces follow-suit.
- [ ] Bad input or a disconnect crashes the server (`card_map.at()` throws; SIGPIPE on writing to a closed socket). **Confirmed in the smoke test:** one player leaving killed all 4 clients and the server. A disconnect must not end the game for everyone (how to handle it is a question for Seif).
- [ ] A dead connection during the contract pick is taken as a pick of `""`, which is broadcast as `game,` (`logic.hpp:123-133`).
- [ ] The `trix` contract isn't implemented (it's played as ordinary tricks and scores 0).
- [ ] `general` never counts `farcha` (`"Farcha"` vs `"farcha"` case mismatch).
- [ ] Scores never reach the clients. The winner is never announced. The process exits after one game.
- [ ] Which contracts each player has already used is tracked only in the client (`available_games`), not in the server.
- [ ] Messages have no delimiters. Timing relies on `sleep(500ms)`. (This goes away with the web rewrite.)
- [ ] A failed `accept()` still adds the invalid connection to the player list (`final.cpp:60-75`).

Client-side issues (`client-sdl`) that matter only if the SDL client lives on:
- [ ] Server address hardcoded to `127.0.0.1:8080`.
- [ ] Assumes one network read equals one message. Crashes on unexpected input (`stoi`, `.at()`, and `played_kwaret[0..3]` in `end_of_pli`).
- [ ] `makefile` builds a nonexistent `pl.cpp`. `run.sh` is the build that works. SDL2 dev headers aren't installed on this machine.

## Later
- [ ] Look / visual pass.
- [ ] Web app (browser client + server network layer; drop the old socket code).
- [ ] Hosting: Oracle Cloud free instance + domain (TLS, process supervision, deploy).

## Open questions (for Seif)
- Is "fix the look" for the SDL client, or only for the web client? (Polishing SDL may be wasted work if it's replaced.)
- Rules walkthrough, to be answered one by one:
  - Deck: 32 cards (7–A), 8 each? Rank order 7<8<9<J<Q<K<10<A? (The smoke test showed 10♦ beating K♦ and 10♣ beating Q♣, both per the code.)
  - What should happen when a player disconnects mid-game (pause and wait for them to reconnect, a bot takes over, abandon the game)?
  - The 7 contracts (`damet`, `ray`, `dineri`, `pli`, `farcha`, `trix`, `general`): what each one means, its scoring, and when a round ends early.
  - Does each player pick each contract exactly once? In what order does the picker rotate? Who deals, and who leads the first trick?
  - How is the `trix` contract played?
  - What ends the game (currently any score > 5000)? Does the lowest or the highest score win?
  - Seating and turn direction.
  - Player names (the server hardcodes `lam3i, bochra, ldhaw, klafez`).
