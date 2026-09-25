# Dineri: Tunisian card and table games

A home for Tunisian card and table games, played with friends through an invite link or alone against bots, in English, French or Arabic. Live at **https://dineri.world**. The first game is **Trix** ([games/trix](games/trix)); more are on the way ([TODO.md](TODO.md)).

| Document | What it covers |
|---|---|
| [TODO.md](TODO.md) | what's open, what's done, what's deployed (each game has its own TODO and changelog) |
| [docs/architecture.md](docs/architecture.md) | how it's built and why: the game contract, data, accounts, hosting, the order of work |
| [docs/adding-a-game.md](docs/adding-a-game.md) | the steps for every new game, from the rules walkthrough to the release |
| [docs/games.md](docs/games.md) | every game: what's decided, what's done, what it still needs |
| [docs/play-modes.md](docs/play-modes.md) | custom rooms, quick play, ranked; profiles and friends (draft) |
| [docs/game-look.md](docs/game-look.md) | how games look: one house, many rooms |
| [brand/BRAND.md](brand/BRAND.md) | Dineri's locked brand: name, logos, colours, type, voice |
| [docs/deploy.md](docs/deploy.md) | the server, its settings, deploying, rolling back, switching a game off |
| [docs/security.md](docs/security.md), [docs/predeploy-check.md](docs/predeploy-check.md) | threats and protections; what was checked before going live |
| [games/trix/RULES.md](games/trix/RULES.md) | Trix's rules, as approved by Seif, with an ID per rule |

## Layout

| Folder | What |
|---|---|
| `platform/sdk` | The game contract: what a game provides so the platform can run it |
| `platform/protocol` | Messages between browser and server |
| `platform/server` | Node + WebSocket: rooms, seats, invites, reconnecting, bots scheduling, persistence, security. Knows no game |
| `platform/ui` | The shared screen kit every game uses: connection, languages, controls, seats, card back |
| `platform/web` | The site: home page, a page per game, lobby, sign-in and account, about/privacy/terms; loads each game's table on demand |
| `brand/` | The brand's source files, tokens and generated logos and icons |
| `firebase/` | Accounts: the database rules and the local emulators (`npm run emulators`) |
| `games/trix` | Trix: its rules, bots, table screens, tests, and its own TODO and changelog ([README](games/trix/README.md)) |
| `deploy/` | The container, the Caddy site file, the deploy script ([docs/deploy.md](docs/deploy.md)) |
| `archive/` | The 2023 C++ server, SDL client and prototype (reference only) |

## Play locally

```bash
npm install
npm run build
npm start            # http://127.0.0.1:8080
TRIX_STATE_FILE=.data/rooms.json npm start   # same, and games survive a restart
```

Open the page, pick a game, pick a name, and create a table. Send the invite link to friends, add bots, or play against bots straight away.

## Develop

```bash
npm run dev          # server on :8080 + Vite on :5173 (open :5173)
npm test             # every package's tests (games and platform)
npm run typecheck
```

- **Station** (Trix): `npm run station` plays hundreds of games over the real protocol with simulated players, checks every move with an independent referee, and attacks the server; see [games/trix/docs/testing-station.md](games/trix/docs/testing-station.md).
- **Arena** (Trix bots): `npm run arena` checks that each bot level beats the one below; results in [games/trix/docs/bots-arena.md](games/trix/docs/bots-arena.md).
- **Browser flows:** `npm run build && node platform/web/e2e/connections.mjs` (friends joining, drops, closed tabs, kicks, two tabs, restarts, the hub, playing against bots).
- **A whole game in a browser:** run a built server with fast bots (`TRIX_SPEED=10 PORT=8123 npm start`), then `npm run e2e -- --base http://127.0.0.1:8123`; add `--viewport 390x844` for phone size.
- **Premoves and drag and drop:** `node platform/web/e2e/premove.mjs OUT --base http://127.0.0.1:8126` against a server at normal speed.
- **Accounts and languages:** `npm run test:accounts` (Firebase's emulators start and stop around it); the browser flow is `platform/web/e2e/accounts.mjs` (how to run it is at its top). The emulators need Java 21.

Server logs are JSON lines (`TRIX_LOG_LEVEL=debug|info|warn|error`); `/api/games` lists the games, `/api/stats` (on the machine itself) shows rooms, sockets and memory.

Deploying: [docs/deploy.md](docs/deploy.md) (`deploy/deploy.sh`), including switching one game off and rolling one game back.

Card faces (every card game, `platform/ui/src/assets/cards`): the faces from Seif's 2023 game (`archive/client-sdl/assets/cards`), which came with GNOME Aisleriot's card backs and look like an older Aisleriot theme (GPL); the exact source is to confirm with Seif. Credited on the site's About page. The card back is Dineri's own (`platform/ui/src/assets/card-back.svg`).
