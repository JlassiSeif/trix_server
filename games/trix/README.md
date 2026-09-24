# Trix

The Tunisian trick-taking game: seven contracts per player, four players, and the lowest score wins. The first game of the hub.

| | |
|---|---|
| Rules | [RULES.md](RULES.md) (approved by Seif; every rule has an ID that tests cite) |
| To do / done | [TODO.md](TODO.md) |
| Versions | [CHANGELOG.md](CHANGELOG.md), tags `trix@<version>`; the version is in `engine/package.json` and `engine/src/module.ts` |
| History | `git log -- games/trix` |

## Folders
- `engine/` (`@games/trix`): the rules as a pure state machine, the bots (`src/bots`), and `src/module.ts`, Trix's side of the game contract. Tests: `npm test -w @games/trix`.
- `ui/` (`@games/trix-ui`): the table screens, card art and contract icons. `src/index.ts` is what the hub loads with its home page; the table itself loads when a Trix table opens.
- `station/` (`@games/trix-station`): the testing station (simulated players over the real protocol, an independent referee, attack scenarios, the mutation check) and the bot arena.
- `docs/`: bots, personas, sounds, arena results, station reports, the old client's baseline.

## Checks before a release
```bash
npm test && npm run typecheck && npm run build
npm run station                                    # every scenario, refereed
npx tsx games/trix/station/src/mutants.ts          # the station still catches deliberate bugs
npm run arena                                      # bot levels still rank correctly
node platform/web/e2e/connections.mjs              # browser flows
```
