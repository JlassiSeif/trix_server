# Pre-deployment check (2026-09-23)

**Verdict: ready to deploy from the software side.** The remaining steps need the machine and the domain (see `docs/deploy.md`, "What I need from Seif"). Everything below was run on the exact build that would be deployed: a self-contained `apps/server/dist/index.js` plus `apps/web/dist`.

## Your questions

**Can the server handle disconnects and reconnects?** Yes.

| Situation | Tested by | Result |
|---|---|---|
| A player drops and returns 15 times in one game (repeated with different seeds) | station S14 | Every drop paused the table and every return resumed it: same seat, same cards |
| A real network cut in a browser (a proxy is cut, then restored) | browser C2 | The page shows "Connection lost. Reconnecting…", the others see "Game paused", and on return the game resumes with the same cards |
| The tab is closed and the room address reopened | browser C3 | Straight back into the seat with the same cards |
| Everyone drops at once, then everyone returns | station S19 | The room is kept, and the game resumes exactly where it was |
| A message over the size limit (the server closes that connection) | station S12 | The table pauses; the player reconnects; the game goes on |
| **The server restarts mid-game (every deploy is one)** | station S24 (3 tables), browser C9 | All 12 players come back to the same contract, cards and totals; the games carry on and finish |

**How does the same player keep their seat?** When someone takes a seat, the server gives their browser a secret **seat token** (128 random bits), and the browser keeps it for that room. On a reconnect, a refresh, or reopening the link, the page sends the token, and the server gives back the same seat, hand and score (R-TABLE-5). Consequences:
- Another person can't take a seat without its token. Old or invented tokens are refused (S16, S20).
- **The same person on a different device** (phone, then laptop) has no token there, so they can't reclaim the seat by themselves. The owner can kick that seat and send the new link; whoever opens it takes over the seat with its cards (browser C5).
- If the seat is opened in a second tab, the older tab steps back and offers "Play here instead" (C6). It no longer fights the new tab for the seat. That was a bug, now fixed.

**What does the room do when someone is missing?**
- **The table pauses** (R-TABLE-4). Nobody can move, the bots wait, and everyone sees "Game paused — waiting for X".
- **The room owner can** play on with a bot for the missing player, or end the game (R-TABLE-7). When the player comes back, they take their seat back from the bot (S15, C7).
- **Leave and kick** empty the seat and create a new invite link; the old link stops working (R-TABLE-6; S16, C5). Leaving now asks for confirmation first (C8).

**What if a fifth person uses the link?**
- **All 4 seats taken by people:** they see "The table is full", and nothing changes (C4, S20).
- **A seat held by a bot:** they take over that bot's seat and cards (R-TABLE-10; C4b).
- **A player who is only disconnected:** their seat stays reserved for them. The newcomer is told the table is full.
- **A seat freed by a leave or kick:** only the *new* link works (C5).

**Can it handle more than two rooms?** Yes. **100 tables at once** (400 connections) all finished their games in 28 s. Memory peaked around 15–17 MB. Every room was cleaned up when its players left, and nothing was logged at error level (S02 with `--tables 100`). The station's privacy and cross-player checks confirm that tables never mix: nobody ever received a card from another player's hand, at any table.

## What this check found and fixed

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | browser C9 and the server log | **A restart ended every game** (rooms lived in memory only), and the pages then **showed a frozen table** | Rooms are saved to disk (0.5 s after each change and on shutdown, written atomically, permissions 600) and restored at start. The server says "restarting" (1012) so browsers reconnect by themselves. A table that is really gone is reported as gone (C10). |
| 2 | browser C6 | **Two tabs on one seat took it from each other endlessly** (12 times in 6 s) | The older tab stops and offers "Play here instead" |
| 3 | browser C8 | **Leaving had no confirmation**, and it gives the seat away for good | Asks first |
| 4 | review | No caps | At most 200 rooms (`SERVER_FULL`) and 1000 connections (close 1013) |
| 5 | review | No HTTP hardening | Security headers (CSP, no-referrer, nosniff, no framing). The page is never cached and hashed assets are cached forever, so a deploy takes effect on the next load. |
| 6 | review | The server needed `node_modules` at run time | It's now a single self-contained file |

Earlier checks, still passing: a refused join pulled a player out of their seat, and a message flood froze the server. See `docs/testing-station.md`.

## Final test run (deploy build)

- Engine: 62/62. Server: 26/26, including the real-port tests for restarts, a broken save file, caps, rate limits and headers.
- Testing station: 20/20 scenarios (final gate: `docs/station-report-predeploy.md`), and 100 tables at once. The mutation check caught 7 of 7 deliberate bugs.
- Browser: connection flows 11/11 (C1–C10), a full game against bots through the UI, and the timed-UI check.

## What I'm not fully sure about yet (known limits)

- **Real phones.** Everything ran in desktop Chromium, including a phone-sized screen, but not on a real iPhone (Safari) or Firefox. Phones cut connections when locked. The reconnect logic handles that in the browser tests, but I'd like one real-phone game right after deploying.
- **Hard crashes** (power loss, `kill -9`) can lose the last half-second of moves; a normal restart loses nothing.
- **If the owner disappears** (phone dies) and never returns, nobody else can resume with a bot or end that game: the table stays paused. **Question for you:** should ownership pass to another player after the owner has been away for a few minutes?
- **Open pages keep the old version** after a deploy until they are refreshed. Changes so far have been backward compatible.
- **Bots are placeholders** and play weakly (R-BOT-2).
- **Card images** are GNOME Aisleriot's (GPL-3.0-or-later). The notice is in the README.
- **"Copy link"** needs HTTPS to use the clipboard. On the domain it will work; locally over http it selects the text instead.

## Right after deploying

1. `curl https://<domain>/api/health`.
2. `npm run station -- --base https://<domain> --only S01,S14,S24`. S24 needs the station's own server, so against production it's skipped; run S01 and S14.
3. One real game with a phone and a laptop, including locking the phone for a minute.
