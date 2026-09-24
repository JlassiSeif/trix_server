# Trix: changelog

Versions of the Trix game (rules, bots and table screens). Releases are tagged `trix@<version>`. Rolling Trix back on its own: see `docs/deploy.md` ("Rolling back one game").

## 1.0.0 (2026-09-25): Trix in the hub
The same game as the live release of 2026-09-24 (`trix-web:dce18c0`), moved into `games/trix` behind the game contract (`platform/sdk` 1.0.0). No change for players. Its page is now `/trix`; invite links and saved seats keep working.

## Before the hub
- **2026-09-24, live `dce18c0`:** bots at three levels (easy, medium, hard) and "Play against bots" (R-BOT-3, R-TABLE-13); the phone layout; trix is due by the 6th pick (R-GAME-11); abandoned tables make way at the per-address limit.
- **2026-09-24, live `fbbe767`:** first deploy to trix.rheona.space.
- **2026-09-23:** the leaderboard; the pre-deployment hardening (games survive restarts, lost tables, two tabs); ownership passes on (R-TABLE-12); the security review.
- **2026-09-23, `v0.5.0`:** first playable version, with placeholder bots.
- **2026-09-23:** rules approved (RULES.md); the engine; the testing station.
