# Adding a game

How every new game joins the hub (docs/architecture.md). Trix (`games/trix`) is the worked example for each step.

## 1. Rules first
A rules walkthrough with Seif, one topic at a time, written down as `games/<game>/RULES.md` with an ID for every rule (`R-…`). No rule is implemented before Seif approves the document. Tunisian games have regional variants: the walkthrough settles which one we play.

## 2. The folder
```
games/<game>/
  README.md  RULES.md  TODO.md  CHANGELOG.md
  engine/   @games/<game>       rules, bots, and src/module.ts (the game contract)
  ui/       @games/<game>-ui    its description for the hub (src/index.ts) and its table screen
  station/  @games/<game>-station  (when it has one) referee and scenarios
  docs/
```
Package names: `@games/<game>`, `@games/<game>-ui`. The engine stays free of Node and React (its `tsconfig.json` has no Node types), so it runs the same on the server and in tests.

## 3. The engine and the contract
The rules are a pure state machine: a seeded start, `apply(state, actor, move)` that checks and never throws or mutates, `view(state, seat)` that never leaks another seat's secrets, `privateTo(event)`. `src/module.ts` exports the game's `GameModule` (`platform/sdk`): its meta (id, name, version, seats, bot levels), flow (`actors`, `status` with breaks and the result), pacing, bots and a fallback move.

Tests: one or more per rule ID, a fuzz run of random games (always finishes, never leaks, never accepts an illegal move), and the bots only ever making legal moves.

## 4. The screens
`ui/src/index.ts` exports a `GameUI` (`platform/ui`): name, tagline, players, bot levels with a line each, and `loadTable()`, which imports the table screen. The table gets the connection; it types it with the game's own view and events (`Connection<View, Event>`). The shared kit covers the rest: invite link, leave button, overlays, panels.

## 5. Register it
- Server: add its module to `platform/server/src/games.ts`.
- Web: add its `GameUI` to `platform/web/src/games.ts`, and take it off the "coming soon" list there.
- Workspaces pick the folder up on their own (`games/*/*`); `deploy/Dockerfile` needs its `package.json` lines.

## 6. Prove it
- Engine tests and the fuzz run.
- A station referee and scenarios for it (the platform station, once it exists), and an arena for its bots.
- Browser flows: create a table, play against bots, an invite link, a refresh mid-game.
- A full game at phone size.

## 7. Release
Version `1.0.0` in its `engine/package.json` and `module.ts`; a CHANGELOG entry; tag `<game>@1.0.0`. Commits touch either one game's folder or the platform, never both, so `git log -- games/<game>` is that game's history.
