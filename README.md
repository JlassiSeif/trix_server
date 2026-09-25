# Tunisian games hub

A home for Tunisian card and table games, played with friends through an invite link or alone against bots. Live at https://trix.rheona.space. The first game is **Trix** ([games/trix](games/trix)); more are on the way ([TODO.md](TODO.md)).

How it's built and why: [docs/architecture.md](docs/architecture.md). Adding a game: [docs/adding-a-game.md](docs/adding-a-game.md).

## Layout

| Folder | What |
|---|---|
| `platform/sdk` | The game contract: what a game provides so the platform can run it |
| `platform/protocol` | Messages between browser and server |
| `platform/server` | Node + WebSocket: rooms, seats, invites, reconnecting, bots scheduling, persistence, security. Knows no game |
| `platform/ui` | The shared screen kit every game uses |
| `platform/web` | The site: home page, a page per game, lobby; loads each game's table on demand |
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

Server logs are JSON lines (`TRIX_LOG_LEVEL=debug|info|warn|error`); `/api/games` lists the games, `/api/stats` (on the machine itself) shows rooms, sockets and memory.

Deploying: [docs/deploy.md](docs/deploy.md) (`deploy/deploy.sh`), including switching one game off and rolling one game back.

Trix's card faces: GNOME Aisleriot "bonded" theme (GPL-3.0-or-later), taken from the old client's assets (also credited on the site's About page). The card back is Dineri's own (`platform/ui/src/assets/card-back.svg`).
