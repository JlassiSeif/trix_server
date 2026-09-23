# Testing station

An automated bug hunt for the Trix server. Simulated players connect over the real WebSocket protocol, exactly as browsers do, play full games, and try to break things. Every move is checked by an independent referee while they play.

```bash
npm run station                                  # all scenarios, 25 tables in the stress case
npm run station -- --only S14,S22 --seed 7       # some scenarios, reproducible
npx tsx tools/station/src/mutants.ts             # check that the station catches deliberate bugs
```

Each run writes to `.station-runs/<time>/`:
- `report.md`: what was expected and what happened, for each scenario.
- `server.log`: the server's structured JSON log at debug level.
- `clients/*.jsonl`: every message each simulated player sent and received.

Bots and countdowns run 20 times faster than normal (`--speed`).

## How it checks

**The referee** (`tools/station/src/referee.ts`) re-implements the rules straight from RULES.md, without calling the engine, so it catches engine bugs as well as server bugs. After every update, each simulated player checks:
- **Its own hand:** it matches the public card count, and has no duplicate cards.
- **All 32 cards are accounted for:** hands, plus the current trick, plus tricks taken; or hands plus the trix stacks.
- **Legal moves:** only offered on your own turn, and only cards you hold. A player whose turn it is always has a legal move.
- **Each card played:** played by the player whose turn it was, and held by them. It follows suit when it must (R-TRICK-2), and fits a trix stack (R-TRIX-1, R-TRIX-3).
- **Each trick:** won by the highest card of the led suit (R-TRICK-3).
- **Picks and declarations:** only the picker picks. K♥ is declared only by the player on turn, in `ray` or `general`, and only once.
- **Contract points:** they add up to what the rules allow.

  | Contract | Allowed totals |
  |---|---|
  | dineri, pli | 80, or one player 150 |
  | damet | 80 |
  | farcha | 100 |
  | ray | 100, or 200 if declared |
  | general | 440, 510, 540 or 610, or all 0 on a sweep |
  | trix | −100 / −50 / 0 / 0 |
- **Multipliers and totals:** ×2 for the picker, ×4 on the forced 7th pick, never trix, and the declarer's −50 unmultiplied. The exact-1000 reset is applied, and game over is declared for the right reason with the right loser.
- **Privacy:** a player never receives another player's look at the last trick.

**The table monitor** (`tools/station/src/table.ts`) compares the 4 players with each other at every broadcast. They must see the same public state and the same room. No message to one player may contain a card that is still in another player's hand. A watchdog flags any game that goes quiet for 5 seconds while it should be moving.

**Unexpected errors:** every message carries an `id`, and an error names the message that caused it (`re`). A legal move that gets refused is flagged, unless the table changed while it was on its way.

**Testing the tester** (`tools/station/src/mutants.ts`) builds the real server with a deliberate bug and checks that the station flags it. Last run, 7 out of 7 were caught:

| Deliberate bug | Caught by |
|---|---|
| lowest card wins the trick | trick-winner |
| follow-suit not enforced | follow-suit |
| diamonds worth 20 | score-dineri, score-general |
| everyone multiplied, not just the picker | score-* for every contract |
| trix: a 10 fits right after the jack | trix-placement, card-conservation |
| the view shows the next player's hand | privacy-hand, hand-count, and others |
| the look at the last trick goes to everyone | privacy-peek |

## Scenarios

| ID | Group | Scenario | Expected |
|---|---|---|---|
| S01 | normal flow | One full game, four players | Reaches game over; referee and monitor clean; everyone agrees on the result |
| S02 | stress | 25 tables at once | All finish; rooms are removed when everyone leaves |
| S03 | normal flow | Play again | All Ready → a new game at 0/0/0/0 that plays to the end |
| S04 | normal flow | 2 players + 2 server bots | Bots only make legal moves; the game finishes |
| S05 | normal flow | Nobody clicks Continue | The next deal starts on its own when the countdown ends |
| S10 | hostile input | Moves spammed out of turn | No illegal move ever takes effect; the game finishes |
| S11 | hostile input | 20 kinds of junk message | Each gets an error; the sender stays seated; the game finishes |
| S12 | hostile input | Message over 4 KB | Connection closed; table pauses; reconnect resumes |
| S13 | hostile input | Every move sent twice | Second copy refused; nothing is played twice |
| S22 | stress | Flood: 20,000 junk messages + 5,000 illegal moves | Both cut off by the rate limit; server stays responsive; game finishes |
| S14 | connections | 15 drops and returns | Each pauses and resumes; same seat and hand |
| S15 | connections | Owner plays on with a bot | Bot plays the seat; the player takes it back on return |
| S16 | connections | Kick mid-game + replacement | Old token and link refused; the new link takes the seat and its hand |
| S17 | connections | Owner leaves mid-game | Ownership and the invite link pass on; the game finishes |
| S18 | connections | Same seat in a second tab | First tab told and dropped; the second plays on |
| S19 | connections | Everyone drops, everyone returns | Room kept; the game resumes exactly where it was |
| S20 | permissions | Refused joins and owner-only actions | 11 requests, each refused with the right code |
| S21 | permissions | Looking at the last trick | Exactly 2 per contract; only the looker sees it |
| S23 | permissions | End game, kick, add bot, restart | Back to the lobby; the full table starts again on its own |

## Findings (2026-09-23)

### Bugs in the game server (fixed)

| # | Found by | Expected | What happened | Cause | Fix | Regression test |
|---|---|---|---|---|---|---|
| 1 | S11 | A refused request leaves a seated player where they are | A `createRoom` with an invalid name, or a `joinRoom` for your own table with a bad invite, **pulled the player out of their seat**. The table paused, and their moves were refused (NOT_SEATED). | The hub left the current table *before* checking the new request | Check first; join the new table first, and leave the old one only once that has worked. Joining your own table again by invite now gets `ALREADY_SEATED`. | `apps/server/test/room.test.ts`, "found by the testing station" |
| 2 | S22 | A flood of junk from one connection doesn't affect anyone else | 20,000 junk messages **froze the server for ~480 ms** (every table stalls), and wrote **20,007 warning lines** to the log | No limit on messages per connection; one log line per bad message | Rate limit per connection: a burst of 80, then 40 per second. Over the limit: `RATE_LIMITED`, disconnected, **one** log line. After the fix, the health check stayed at 6 ms during the flood. | `apps/server/test/limiter.test.ts`, S22 |
| 3 | UI (before the station) | The pick banner goes away on its own | The "X chose …" banner, the completed trick and the last-trick look stayed on screen | Event listener re-subscribed on every render, which cancelled their timers | Subscribe once | `npm run e2e:timed` |

### Logging gaps (fixed)
- **Errors couldn't be traced to the message that caused them.** Messages can now carry an `id`, and errors echo it as `re`. The browser can use this too.
- **Adding a bot, or a bot standing in for someone, wasn't logged.** Now logged as `seat.botAdded` and `seat.botStandIn`.
- **The server's logs were unstructured.** Now JSON lines (`apps/server/src/log.ts`), covering:
  - joins, reconnects, disconnects and vacated seats;
  - pause and resume transitions;
  - every accepted or refused move with its code;
  - game start with its seed (so a game can be replayed), each contract's score, and game over;
  - crashes with stack traces.

  The level is set with `TRIX_LOG_LEVEL`. `/api/stats` gives room, socket and memory counts.

### Confirmed working
- 25 tables at once finish cleanly, and every room is removed afterwards.
- Out-of-turn moves, double clicks and junk never change a game.
- Disconnects, returns, a second tab, kicks, owners leaving and bot stand-ins all behave as RULES.md §7 says.
- The last-trick limit and its privacy hold.
- Nobody ever received another player's cards.

**A note on moves in flight.** A move sent just as the turn passes can arrive when it has become legal, and the server accepts it. That's correct: the server always judges against the real state, and the referee checks that no illegal move ever takes effect.

### Bugs in the station itself (fixed while building it)
These were my test harness's bugs, not the game's. They're listed so the results can be trusted:
- A closed client wrote to its log file.
- A player didn't retry a move refused during a 3 ms pause.
- Players remembered game 1's states in game 2.
- Bots were added before the owner's view showed everyone seated.
- A move was sent without re-checking that it was still legal.
- The S20 cases weren't marked deliberate.
- Findings were lost when a scenario crashed.
- The end-of-game check didn't wait for all 4 players.
