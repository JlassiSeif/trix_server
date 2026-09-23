# Trix

The Tunisian card game Trix, as a web app for one table of 4 friends.
Rules: [RULES.md](RULES.md). Plan and progress: [TODO.md](TODO.md).

## Play locally

```bash
npm install
npm run build
npm start            # http://127.0.0.1:8080
```

Open the page, pick a name, and create a table. You can send the invite link to friends or fill the other seats with **Add a bot**. The game starts when all 4 seats are taken.

## Develop

```bash
npm run dev          # server on :8080 + Vite on :5173 (open :5173)
npm test             # engine + server tests
npm run typecheck
```

End-to-end: run a built server with fast bots (`TRIX_SPEED=10 PORT=8123 npm start`), then `npm run e2e -- --base http://127.0.0.1:8123`. It plays a whole game in Chromium through the UI and saves screenshots to `e2e-out/`. `npm run e2e:timed -- --base URL` checks, at normal bot speed, that banners, the completed trick and the last-trick look go away on their own. If Playwright's own Chromium isn't installed, point `CHROMIUM=` at a Chrome/Chromium binary.

## Layout

- `packages/engine`: the rules (a pure state machine), tested against the rule IDs in RULES.md
- `packages/protocol`: messages between browser and server
- `apps/server`: Node + WebSocket; rooms, seats, bots, timers
- `apps/web`: React + Vite client. Cards and contract icons come from the old client's assets.
- `archive/`: the 2023 C++ server, SDL client and prototype (reference only)

Card images: GNOME Aisleriot "bonded" theme (GPL-3.0-or-later), taken from the old client's assets.
