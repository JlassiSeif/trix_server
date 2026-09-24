# Testing station report

- Run: 2026-09-23T17-03-08 · seed 61 · speed ×20 · 25 tables in the stress case · 194 s
- Server: http://127.0.0.1:36769 · logs: `server.log` and `clients/*.jsonl` in this folder
- **20/20 scenarios passed**

| | ID | Scenario | Got |
|---|---|---|---|
| ✅ | S01 | One full game, four players | game over after 13 contracts (overLimit), totals 500/940/300/1020 |
| ✅ | S02 | Many tables at once | 25/25 tables finished in 14.3 s. Rooms 1 → 26 → 1; sockets 100 → 0; heap 10.1 → 12.1 → 22.9 MB |
| ✅ | S03 | Play again after the game | first: game over after 8 contracts (overLimit), totals 380/330/260/1260; second: game over after 17 contracts (overLimit), totals 840/1040/890/90 |
| ✅ | S04 | Two players and two server bots | game over after 21 contracts (overLimit), totals 800/410/850/1070 |
| ✅ | S05 | Nobody clicks Continue | gaps between contracts: 497 ms, 499 ms, 499 ms (target 500 ms); game over after 16 contracts (overLimit), totals 450/760/140/1020 |
| ✅ | S10 | Players spam moves out of turn | 718 moves sent out of turn: 718 refused, 0 accepted because they had become legal on arrival (each checked by the referee); game over after 18 contracts (overLimit), totals 320/1050/490/730 |
| ✅ | S11 | Junk and malformed messages | game over after 7 contracts (overLimit), totals 480/-20/90/1190 |
| ✅ | S12 | Message over the 4 KB limit | connection closed: true (code 1009); table paused: true; resumed after reconnect: true; game over after 12 contracts (overLimit), totals 210/540/1110/770 |
| ✅ | S13 | Every move sent twice (double click) | 409 moves sent twice, 409 second copies refused; game over after 15 contracts (overLimit), totals 630/550/1120/440 |
| ✅ | S22 | Message flood while a table plays | outsider cut off: true after 81 replies; flooding player cut off: true; flood took 225 ms; health p95 6 ms, max 6 ms over 15 probes; game over after 20 contracts (overLimit), totals 490/700/1040/240 |
| ✅ | S14 | A player keeps dropping and coming back | 15 drops: pauses 15, resumes 15, same hand 15; game over after 18 contracts (overLimit), totals 1080/530/680/710 |
| ✅ | S15 | Owner plays on with a bot, then the player returns | bot played ≥3 cards for the missing player; player back in control: true; game over after 14 contracts (overLimit), totals 1100/330/690/910 |
| ✅ | S16 | Kick in the middle of a game, replacement joins | kicked player removed; table paused: true; old token/old link: BAD_TOKEN, BAD_INVITE; new link differs: true; replacement took seat 3 with 0 cards; game over after 20 contracts (overLimit), totals 810/640/730/1020 |
| ✅ | S17 | The owner leaves in the middle of a game | new owner: seat 1; has invite link: true; paused: true; game over after 13 contracts (overLimit), totals 470/580/1070/190 |
| ✅ | S18 | The same seat opened in a second tab | first tab told "REPLACED": true; first tab disconnected: true; second tab seat 2; game over after 16 contracts (overLimit), totals 610/280/1090/370 |
| ✅ | S19 | Everyone drops at once, then everyone returns | rooms 15 → 15 while away; game unchanged on return: true; game over after 14 contracts (overLimit), totals 1080/400/330/230 |
| ✅ | S24 | The server restarts during three games | 12/12 players back to exactly the same game; game over after 14 contracts (overLimit), totals 450/110/550/1100 · game over after 23 contracts (overLimit), totals 820/990/1090/870 · game over after 18 contracts (overLimit), totals 460/1230/600/720 |
| ✅ | S20 | Refused joins and owner-only actions | 11/11 refused with the expected code |
| ✅ | S21 | Looking at the last trick: limit and privacy | looks shown 2, refusals CANNOT_PEEK (still same contract: true); game over after 18 contracts (overLimit), totals 520/70/690/1080 |
| ✅ | S23 | Lobby: end a game, kick, add a bot, start again | back to lobby: true; new game started on its own: true; game over after 14 contracts (overLimit), totals 470/1250/590/570 |

## ✅ S01: One full game, four players

*normal flow · 6.2 s*

**Expected:** The game reaches game over. Every move passes the referee, all 4 players see the same public state and the same result, nobody sees another player's cards, and no legal move is refused.

**Got:** game over after 13 contracts (overLimit), totals 500/940/300/1020

Checks:
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S02: Many tables at once

*stress · 14.6 s*

**Expected:** All tables finish their games with no findings. When everyone leaves, every room is removed and memory settles.

**Got:** 25/25 tables finished in 14.3 s. Rooms 1 → 26 → 1; sockets 100 → 0; heap 10.1 → 12.1 → 22.9 MB

Checks:
- ✅ 25/25 tables finished
- ✅ rooms back to 1 after everyone left (got 1)

Referee findings: none

Unexpected errors: none

## ✅ S03: Play again after the game

*normal flow · 12.6 s*

**Expected:** After game over all 4 click Ready; a new game starts at contract 1 with totals 0/0/0/0 and plays to the end (R-TABLE-8).

**Got:** first: game over after 8 contracts (overLimit), totals 380/330/260/1260; second: game over after 17 contracts (overLimit), totals 840/1040/890/90

Checks:
- ✅ second game starts at 0/0/0/0
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S04: Two players and two server bots

*normal flow · 23.1 s*

**Expected:** The server's bots and the two players finish a game together; the bots only make legal moves (R-BOT-1).

**Got:** game over after 21 contracts (overLimit), totals 800/410/850/1070

Checks:
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S05: Nobody clicks Continue

*normal flow · 15.3 s*

**Expected:** Between contracts the next deal starts on its own when the countdown ends (10 s, divided by the test speed) (R-TABLE-11).

**Got:** gaps between contracts: 497 ms, 499 ms, 499 ms (target 500 ms); game over after 16 contracts (overLimit), totals 450/760/140/1020

Checks:
- ✅ each gap within 0.8×–2× of 500 ms

Referee findings: none

Unexpected errors: none

## ✅ S10: Players spam moves out of turn

*hostile input · 9.1 s*

**Expected:** No illegal move ever takes effect (the referee checks every event: who played, who picked, who declared); illegal moves are refused with an error; the game finishes normally. A move that became legal by the time it reached the server (the turn had just passed to that player) may be accepted.

**Got:** 718 moves sent out of turn: 718 refused, 0 accepted because they had become legal on arrival (each checked by the referee); game over after 18 contracts (overLimit), totals 320/1050/490/730

Checks:
- ✅ nearly all refused (718/718)
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S11: Junk and malformed messages

*hostile input · 3.6 s*

**Expected:** Each junk message gets an error back; the sender stays connected and seated; the table keeps playing and finishes.

**Got:** game over after 7 contracts (overLimit), totals 480/-20/90/1190

Checks:
- ✅ empty string: error reply and sender still seated
- ✅ broken JSON: error reply and sender still seated
- ✅ null: error reply and sender still seated
- ✅ array: error reply and sender still seated
- ✅ number: error reply and sender still seated
- ✅ type is a number: error reply and sender still seated
- ✅ action without body: error reply and sender still seated
- ✅ action: null: error reply and sender still seated
- ✅ card is an object: error reply and sender still seated
- ✅ card __proto__: error reply and sender still seated
- ✅ contract toString: error reply and sender still seated
- ✅ type __proto__: error reply and sender still seated
- ✅ type constructor: error reply and sender still seated
- ✅ kick seat -1: error reply and sender still seated
- ✅ kick seat '0': error reply and sender still seated
- ✅ addBot seat 9: error reply and sender still seated
- ✅ joinRoom with object id: error reply and sender still seated
- ✅ deep nesting: error reply and sender still seated
- ✅ createRoom, name is a number: error reply and sender still seated
- ✅ joinRoom own room, bad invite: error reply and sender still seated
- ✅ all players see the same final result (1 distinct)

Details:
- empty string: BAD_MESSAGE; still seated
- broken JSON: BAD_MESSAGE; still seated
- null: BAD_MESSAGE; still seated
- array: BAD_MESSAGE; still seated
- number: BAD_MESSAGE; still seated
- type is a number: BAD_MESSAGE; still seated
- action without body: BAD_ACTION; still seated
- action: null: BAD_ACTION; still seated
- card is an object: BAD_ACTION; still seated
- card __proto__: BAD_ACTION; still seated
- contract toString: WRONG_PHASE; still seated
- type __proto__: BAD_MESSAGE; still seated
- type constructor: BAD_MESSAGE; still seated
- kick seat -1: NOT_OWNER; still seated
- kick seat '0': NOT_OWNER; still seated
- addBot seat 9: NOT_OWNER; still seated
- joinRoom with object id: ROOM_NOT_FOUND; still seated
- deep nesting: BAD_MESSAGE; still seated
- createRoom, name is a number: BAD_NAME; still seated
- joinRoom own room, bad invite: ALREADY_SEATED; still seated

Referee findings: none

Unexpected errors: none

## ✅ S12: Message over the 4 KB limit

*hostile input · 5.8 s*

**Expected:** The server closes that connection (the limit protects it); the table pauses; the player reconnects with their seat token and the game goes on to the end.

**Got:** connection closed: true (code 1009); table paused: true; resumed after reconnect: true; game over after 12 contracts (overLimit), totals 210/540/1110/770

Checks:
- ✅ oversized message closes the connection
- ✅ table pauses
- ✅ table resumes after reconnect

Referee findings: none

Unexpected errors: none

## ✅ S13: Every move sent twice (double click)

*hostile input · 7.6 s*

**Expected:** The first copy of each move is played, the second is refused; no card is ever played twice; the game finishes.

**Got:** 409 moves sent twice, 409 second copies refused; game over after 15 contracts (overLimit), totals 630/550/1120/440

Checks:
- ✅ every second copy refused (409/409)
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S22: Message flood while a table plays

*stress · 10.7 s*

**Expected:** An outsider floods 20,000 junk messages and a seated player floods 5,000 illegal moves: both are cut off by the rate limit (RATE_LIMITED, disconnected) after about 80 messages, the server stays responsive throughout (health check under 100 ms), the seated player reconnects with their token and the game finishes.

**Got:** outsider cut off: true after 81 replies; flooding player cut off: true; flood took 225 ms; health p95 6 ms, max 6 ms over 15 probes; game over after 20 contracts (overLimit), totals 490/700/1040/240

Checks:
- ✅ outsider cut off by the rate limit
- ✅ flooding player cut off by the rate limit
- ✅ health p95 under 100 ms (got 6)
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S14: A player keeps dropping and coming back

*connections · 10.9 s*

**Expected:** 15 times: the drop pauses the table, the player comes back with their seat token to the same seat and the same hand, and the table resumes (R-TABLE-4, R-TABLE-5). The game finishes.

**Got:** 15 drops: pauses 15, resumes 15, same hand 15; game over after 18 contracts (overLimit), totals 1080/530/680/710

Checks:
- ✅ every drop paused and every return resumed (15/15 of 15)
- ✅ hand unchanged while away

Referee findings: none

Unexpected errors: none

## ✅ S15: Owner plays on with a bot, then the player returns

*connections · 7.1 s*

**Expected:** While the player is away, the bot plays their seat; when they return they take the seat back and the bot stops (R-TABLE-5, R-TABLE-7). The game finishes.

**Got:** bot played ≥3 cards for the missing player; player back in control: true; game over after 14 contracts (overLimit), totals 1100/330/690/910

Checks:
- ✅ player takes the seat back

Referee findings: none

Unexpected errors: none

## ✅ S16: Kick in the middle of a game, replacement joins

*connections · 10.4 s*

**Expected:** The kicked player is told and disconnected; their token and the old invite link stop working; a new player with the new link takes the seat with its hand, and the game finishes (R-TABLE-6).

**Got:** kicked player removed; table paused: true; old token/old link: BAD_TOKEN, BAD_INVITE; new link differs: true; replacement took seat 3 with 0 cards; game over after 20 contracts (overLimit), totals 810/640/730/1020

Checks:
- ✅ table pauses on the empty seat
- ✅ old token → BAD_TOKEN, old link → BAD_INVITE (got BAD_TOKEN, BAD_INVITE)
- ✅ a new invite link
- ✅ replacement takes the same seat and its cards

Referee findings: none

Unexpected errors: none

## ✅ S17: The owner leaves in the middle of a game

*connections · 10.4 s*

**Expected:** Ownership passes to another player, who gets the invite link and the owner controls; they play on with a bot and the game finishes.

**Got:** new owner: seat 1; has invite link: true; paused: true; game over after 13 contracts (overLimit), totals 470/580/1070/190

Checks:
- ✅ ownership passes on
- ✅ new owner gets the invite link
- ✅ table pauses on the empty seat

Referee findings: none

Unexpected errors: none

## ✅ S18: The same seat opened in a second tab

*connections · 8.9 s*

**Expected:** The first tab is told the seat was opened elsewhere and is disconnected; the second tab plays on; the game finishes.

**Got:** first tab told "REPLACED": true; first tab disconnected: true; second tab seat 2; game over after 16 contracts (overLimit), totals 610/280/1090/370

Checks:
- ✅ first tab is told and disconnected
- ✅ second tab has the same seat

Referee findings: none

Unexpected errors: none

## ✅ S19: Everyone drops at once, then everyone returns

*connections · 7.8 s*

**Expected:** The room survives with nobody connected; when all 4 return with their tokens the game resumes where it was and finishes.

**Got:** rooms 15 → 15 while away; game unchanged on return: true; game over after 14 contracts (overLimit), totals 1080/400/330/230

Checks:
- ✅ room kept while nobody is connected
- ✅ game picks up exactly where it was

Referee findings: none

Unexpected errors: none

## ✅ S24: The server restarts during three games

*connections · 10.8 s*

**Expected:** Three tables are mid-game when the server restarts, as on every deploy. Every player comes back with their seat token to the same contract and the same cards, the referee stays clean across the restart, and all three games finish.

**Got:** 12/12 players back to exactly the same game; game over after 14 contracts (overLimit), totals 450/110/550/1100 · game over after 23 contracts (overLimit), totals 820/990/1090/870 · game over after 18 contracts (overLimit), totals 460/1230/600/720

Checks:
- ✅ everyone back to the same contract, cards and totals
- ✅ all players see the same final result (1 distinct)
- ✅ all players see the same final result (1 distinct)
- ✅ all players see the same final result (1 distinct)

Referee findings: none

Unexpected errors: none

## ✅ S20: Refused joins and owner-only actions

*permissions · 0.0 s*

**Expected:** Each request is refused with the right code: full table ROOM_FULL, unknown room ROOM_NOT_FOUND, bad token BAD_TOKEN, blank or non-text name BAD_NAME, moves before joining NOT_SEATED, owner actions by others NOT_OWNER, kicking yourself BAD_MESSAGE.

**Got:** 11/11 refused with the expected code

Checks:
- ✅ join a full table → ROOM_FULL (got ROOM_FULL)
- ✅ join an unknown room → ROOM_NOT_FOUND (got ROOM_NOT_FOUND)
- ✅ rejoin with a made-up token → BAD_TOKEN (got BAD_TOKEN)
- ✅ join with a blank name → BAD_NAME (got BAD_NAME)
- ✅ join with a number as name → BAD_NAME (got BAD_NAME)
- ✅ move before joining → NOT_SEATED (got NOT_SEATED)
- ✅ non-owner adds a bot → NOT_OWNER (got NOT_OWNER)
- ✅ non-owner kicks → NOT_OWNER (got NOT_OWNER)
- ✅ non-owner ends the game → NOT_OWNER (got NOT_OWNER)
- ✅ non-owner resumes with bots → NOT_OWNER (got NOT_OWNER)
- ✅ owner kicks themself → BAD_MESSAGE (got BAD_MESSAGE)

Details:
- join a full table: expected ROOM_FULL, got ROOM_FULL
- join an unknown room: expected ROOM_NOT_FOUND, got ROOM_NOT_FOUND
- rejoin with a made-up token: expected BAD_TOKEN, got BAD_TOKEN
- join with a blank name: expected BAD_NAME, got BAD_NAME
- join with a number as name: expected BAD_NAME, got BAD_NAME
- move before joining: expected NOT_SEATED, got NOT_SEATED
- non-owner adds a bot: expected NOT_OWNER, got NOT_OWNER
- non-owner kicks: expected NOT_OWNER, got NOT_OWNER
- non-owner ends the game: expected NOT_OWNER, got NOT_OWNER
- non-owner resumes with bots: expected NOT_OWNER, got NOT_OWNER
- owner kicks themself: expected BAD_MESSAGE, got BAD_MESSAGE

Referee findings: none

Unexpected errors: none

## ✅ S21: Looking at the last trick: limit and privacy

*permissions · 8.3 s*

**Expected:** A player gets exactly 2 looks per contract (the 3rd is refused with CANNOT_PEEK); only that player receives what they looked at (R-TRICK-6).

**Got:** looks shown 2, refusals CANNOT_PEEK (still same contract: true); game over after 18 contracts (overLimit), totals 520/70/690/1080

Checks:
- ✅ exactly 2 looks shown (got 2)
- ✅ 3rd look refused with CANNOT_PEEK

Referee findings: none

Unexpected errors: none

## ✅ S23: Lobby: end a game, kick, add a bot, start again

*permissions · 11.2 s*

**Expected:** The owner ends the game (back to the lobby), kicks a player, fills the seat with a bot; the full table starts a new game on its own and finishes it.

**Got:** back to lobby: true; new game started on its own: true; game over after 14 contracts (overLimit), totals 470/1250/590/570

Checks:
- ✅ end game → lobby
- ✅ bot fills the seat and the game starts

Referee findings: none

Unexpected errors: none

## Server log

27661 lines: info 2730, debug 24841, warn 90

| level + event | count |
|---|---|
| debug action.accepted | 23852 |
| info action.rejected | 1207 |
| info contract.scored | 740 |
| debug bot.move | 535 |
| debug ws.open | 227 |
| debug ws.close | 227 |
| info seat.joined | 184 |
| info room.status | 146 |
| info seat.disconnected | 115 |
| info seat.vacated | 103 |
| warn message.bad | 87 |
| info game.started | 49 |
| info room.created | 47 |
| info game.over | 47 |
| info seat.reconnected | 35 |
| info room.closed | 25 |
| info request.refused | 20 |
| info seat.botAdded | 3 |
| info server.listening | 2 |
| warn ws.rateLimited | 2 |
| info seat.botStandIn | 2 |
| info server.stopping | 2 |
| info server.stopped | 2 |
| warn ws.error | 1 |
| info state.restored | 1 |
