# Trix: changelog

Versions of the Trix game (rules, bots and table screens). Releases are tagged `trix@<version>`. Rolling Trix back on its own: see `docs/deploy.md` ("Rolling back one game").

## 1.1.0 (2026-09-25): three languages, the house style, premoves
- **Drag and drop, and premoves like chess.com** (R-TABLE-14, Seif 2026-09-25): tap or drag a card onto the table to play it; before your turn, the same gesture premoves it, and it plays by itself when your turn comes, or is cancelled with a notice if it can't be played then. Tap it again, tap the table or right-click to cancel. Cards that surely can't follow the suit led can't be premoved.
- **The table in Dineri's house style** (docs/game-look.md, approved by Seif 2026-09-25): the brand's fonts and colours, the felt with its brass rim, ivory cards for choosing, summaries and game over, night panels with Dineri's name and the language menu, the shared seat look with bot levels in pips, Dineri's card back. Seif's hand-drawn contract icons from 2023 stay as drawn, on an ivory tile. Layout, gameplay and rules unchanged.
- **Three languages** (R-TABLE-9): English, French, Arabic.

## 1.0.0 (2026-09-25): Trix in the hub
The same game as the live release of 2026-09-24 (`trix-web:dce18c0`), moved into `games/trix` behind the game contract (`platform/sdk` 1.0.0). No change for players. Its page is now `/trix`; invite links and saved seats keep working.

## Before the hub
- **2026-09-24, live `dce18c0`:** bots at three levels (easy, medium, hard) and "Play against bots" (R-BOT-3, R-TABLE-13); the phone layout; trix is due by the 6th pick (R-GAME-11); abandoned tables make way at the per-address limit.
- **2026-09-24, live `fbbe767`:** first deploy to trix.rheona.space.
- **2026-09-23:** the leaderboard; the pre-deployment hardening (games survive restarts, lost tables, two tabs); ownership passes on (R-TABLE-12); the security review.
- **2026-09-23, `v0.5.0`:** first playable version, with placeholder bots.
- **2026-09-23:** rules approved (RULES.md); the engine; the testing station.
