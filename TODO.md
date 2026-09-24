# Tunisian games hub: TODO

The platform's list, and the index of games. Each game keeps its own list in `games/<game>/TODO.md`. We reconcile these files with the disk at the start of every session. Sources of truth: the disk, Seif, and these files. Anything not written here or confirmed by Seif is an open question, not a decision.

## Goal
A home for Tunisian card and table games, played with friends or against bots, at https://trix.rheona.space. If it gets popular: accounts, customization, ladders and events (below).

## Games

| Game | Status | Folder | Version |
|---|---|---|---|
| Trix | Live | [games/trix](games/trix) ([TODO](games/trix/TODO.md)) | 1.0.0 |
| Chkobba, rami, bent walad, loup garou, dominos, tehchi fih, an Uno-style game, a Monopoly-style game, jhayech, Pablo, the goose game | Wanted (Seif's friends, 2026-09-24); each starts with a rules walkthrough with Seif | | |

Adding a game: [docs/adding-a-game.md](docs/adding-a-game.md).

## Open
1. **Deploy the restructure** (architecture phase 1, built 2026-09-25): waiting for Seif to try it.
2. **Architecture phase 2, fun for every game:** a settings panel (sounds, memes, music, bot chat, 18+ mode off by default), the sound system, chat bubbles and personas. Trix's content: `games/trix/TODO.md`.
3. **Own machine before going public** (architecture §11). Which machine? Seif's Oracle free account?
4. **The hub's name and address:** still "Tunisian games" at trix.rheona.space. Seif to decide.
5. **Platform station:** the testing station lives in `games/trix/station`. Its game-independent parts (simulated players, attack scenarios) move to `platform/station` when the second game arrives.

## Roadmap (Seif, 2026-09-24): if this gets popular, this is where the value is
The phases are in [docs/architecture.md](docs/architecture.md) §13. Applies to Trix, rami, chkobba and most card games.
- **Accounts:** play as a guest, then keep your progress with an account.
- **Player personas and voice lines:** personas people pick for themselves, and voice lines they trigger to talk to the table.
- **Customization:** card backs, card faces and shapes, table art, and each player's own corner of the table.
- **Ladders:** rankings per game, seasons.
- **Events:** tournaments where people win things (cosmetics, badges, sponsor prizes; never cash, which would be gambling law).
- **Monetization:** the customizations above as the main income, plus sponsorship (see the 2026-09-24 conversation).

## Done (platform)
- **Repository:** one repo at `~/trix`; the 2023 C++ server and SDL client live in `archive/` as reference only. Baseline commit `7aab93e`.
- **GitHub (2026-09-25):** pushed to `JlassiSeif/trix_server` with the release tags (`v0.5.0`, `trix@1.0.0`, `platform@1.0.0`). This machine pushes with its own key, `~/.ssh/trix_github` (a deploy key with write access), set for this repo only (`git config core.sshCommand`). Automated tests and deploys (architecture phase 4) can build on it.
- **Architecture phase 1 (2026-09-25):** `docs/architecture.md` approved by Seif (one repository with a folder per game; restructure first). The platform (`platform/`) runs any game through the game contract (`platform/sdk`); Trix is `games/trix`. Hub home page, a page per game, per-game off switch (`TRIX_CLOSED_GAMES`), `GET /api/games`, per-game TODO, changelog and version. A test-only second game proves the platform doesn't depend on Trix.
- **Security review:** `docs/security.md`. Per-address limits, a lockout on guessing, an origin check, unique names, HTTP hardening; npm audit clean.
- **Pre-deployment check:** `docs/predeploy-check.md`. Games survive restarts, lost tables are handled, two tabs can't fight over one seat, caps plus security and cache headers.
- **Hosting:** a guest container on the shared Rheona VPS, under the box's rules (`deploy/new_tenant.md`). `deploy/deploy.sh` builds, ships, proves the container, reloads Caddy only when needed and runs the post-checks; `docs/deploy.md` covers the rest. Live releases: `fbbe767` and `dce18c0` (2026-09-24).
- **Abandoned tables (2026-09-24):** at the 5-tables-per-address limit, a table nobody is connected to makes way for the new one. The 6-hour cleanup stays.
- **Last full check (2026-09-25, the restructured hub):** unit tests 129/129 (79 Trix, 50 platform, including a test-only second game), typecheck and build clean, station 31/31, mutation check 8/8, arena (hard > medium > easy, same results as before the move), browser flows 17/17, full games at desktop and phone size, the deploy image builds and serves /, /trix and /api/games.
