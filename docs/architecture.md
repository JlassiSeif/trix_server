# Architecture for the games hub

**Status: APPROVED by Seif, 2026-09-24:** one repository with a folder per game (§3), and the restructure first (§13). **Phase 1 built 2026-09-25**: the layout below exists, Trix runs behind the game contract, and a test-only second game proves the platform doesn't depend on Trix. Still open: which machine to move to (decision 4).

## 1. What it has to hold up

| | Today | Where it's going |
|---|---|---|
| Games | Trix | 10+ Tunisian games: card games (Trix, chkobba, rami, Pablo, an Uno-style game, bent walad…), dominos, board games (the goose game, a Monopoly-style game), social deduction (loup garou, 6–20 players, voting) |
| Players | Friends, a few tables at once | Hopefully thousands, with evening and Ramadan peaks, Tunisia and the diaspora |
| People | Guests with a name | Accounts, profiles, ladders, seasons, events |
| Content | Aisleriot cards | Card backs, card faces, table art, player corners, personas, voice lines, sounds, music: most of it earned or bought |
| Changes | One deploy for everything | Each game updated and rolled back on its own, often, without breaking live games |

**The honest scaling picture:** raw load is not the hard part. Trix measured 18 MB idle and 34 MB with 50 tables at once; a hard bot thinks for about 1 ms. One ordinary server process can hold thousands of tables. What breaks projects like this is **complexity**: many games touching the same code, one game's update breaking another, and money and accounts added in a hurry. So the architecture below is mostly about **boundaries**, with a clear path to more machines when the numbers ask for it.

## 2. The recommendation in one paragraph

One repository, organized as a **platform** plus one folder per **game**. Each game folder is a self-contained package: its own rules document, TODO, changelog, version, tests and history, so it can be updated and rolled back on its own. The platform provides everything that isn't a game rule: rooms, seats, invites, reconnecting, bots scheduling, chat, audio, settings, and later accounts, cosmetics, ladders and events. Games plug in through one **game contract**. It runs as **one server** (a "modular monolith") with a database added when accounts arrive. It moves to its **own machine** before the site goes public, and splits into more processes only when measurements say so.

## 3. Code: one repository, a folder per game (instead of separate repositories)

You asked for each game to be a sub-repository with its own done items, TODO and history, so each game can be rolled back and updated separately. Separate git repositories (submodules) would do it, but at a real cost: every platform change must be released and then pulled into every game repository in step, submodules are notoriously easy to get out of sync, and testing "does every game still work with this platform change" gets spread over many places.

**A folder per game in one repository gives the same things with none of that:**

| You want | How the game folder gives it |
|---|---|
| Its own done items and TODO | `games/<game>/TODO.md`; the root TODO.md becomes the platform's list plus an index of games |
| Its own history | `git log -- games/<game>` shows only that game's changes; commits never mix a game and the platform |
| Its own versions | `games/<game>/package.json` has its version; releases are tagged `trix@1.4.0`; `games/<game>/CHANGELOG.md` says what changed |
| Rolled back on its own | Restore that folder from its previous tag (`git checkout trix@1.3.0 -- games/trix`), commit, deploy. Other games don't move. Plus a switch that closes new tables for one game at once, without a deploy |
| Updated on its own | A change to one game only touches its folder; tests run for that game and the platform |
| Safe against platform changes | The game contract has its own version; every game declares which it supports; every platform change is tested against every game |

If one day a friend builds a game on their own, that game can move to its own repository then and plug in through the same contract. The door stays open.

### Proposed layout

```
platform/
  sdk/        the game contract, shared types, test helpers (referee harness), card helpers
  protocol/   messages between browser and server, game-agnostic envelope
  server/     rooms, seats, invites, reconnects, persistence, bot scheduling, security (no game rules)
  web/        the hub: home and game picker, routing, settings, audio, chat bubbles, lobby, room chrome
  ui/         the shared kit: connection, invite link, leave button, overlays
  station/    (when the second game arrives) simulated players and attack scenarios for any game
games/
  trix/
    README.md  RULES.md  TODO.md  CHANGELOG.md
    engine/    rules and bots, and module.ts (the game contract)
    ui/        its description for the hub, and its table screens
    station/   Trix's referee and scenarios
    docs/      bots.md, personas.md, arena results …
docs/          platform docs: architecture, security, deploy
deploy/
TODO.md        platform TODO + index of games
```

## 4. The game contract (the heart of it)

What a game provides:

| Part | What it is | Trix today |
|---|---|---|
| **Rules** | A pure state machine: set up, list legal moves for a seat, apply a move (or refuse it), say which events are private, say what each seat may see, say when it's over and who won | `createGame`, `legalActions`, `applyAction`, `viewFor`, `privateTo`, `standings` |
| **Flow hints** | What the platform should do by itself: "deal the next round after a break everyone can skip", "this seat has 20 s", "pause between tricks" | Hard-coded in the room today (contract end, Continue, 10 s) |
| **Bots** | Given a seat's view and the public events: a move. Levels and personas | `botAction` |
| **Meta** | Name, player counts (Trix 4; chkobba 2 or 4 in teams; loup garou 6–20), teams, house-rule options, contract version | Implicit |
| **Screens** | The table for that game, loaded only when someone opens it | `Table.tsx` |
| **Tests** | Rules tests, a referee for the station, arena matchups | All exist for Trix |

What the platform provides to every game: rooms and invite links, seats and reconnecting, owner powers, pauses, stand-in bots, surviving restarts, rate limits and security, chat bubbles and voice lines, sounds and music, settings, the lobby, and later accounts, cosmetics, ladders and events.

Two design points that matter for later games:
- **Not everyone acts in turn.** Loup garou votes at the same time, and some games have "first to call it" moments. The contract says *who may act now* (any number of seats), not "whose turn it is".
- **Rooms remember the game version they started with.** A game update must be able to restore a table saved by the previous version (Trix already tests this for its own saves). A breaking change comes with a migration, or lets old tables finish on their version.

## 5. The server: one process now, more later

- **Today and next:** one Node process holds the live tables in memory and saves them on every change (a file today, the database later). It's authoritative: every move goes through the game's rules. That's the right design for card games and doesn't change.
- **Grows by:** more processes, each holding some of the tables. A small directory tells the browser which process holds its table. This is the standard pattern for real-time games (Colyseus and similar frameworks work this way). We add it when one process is actually busy, not before.
- **Why not microservices now:** separate services for accounts, store, ladders and games multiply deploys, failure modes and cost, for load we don't have. Inside the one server, each concern is its own module with its own folder, tests and data tables, so any of them can be split out later.

## 6. Data

| Data | Where | Why |
|---|---|---|
| Live tables | Memory, saved on every change | Speed; they survive restarts today |
| Sign-in (who you are) | **Firebase Authentication**, project `dineri-world` | Seif's choice (2026-09-25): Google and email links without building password handling |
| Profiles (name at the table, language) | **Firestore** (europe-west3, Frankfurt, next to the server), written only by the server | Small documents; the browser never touches the database (firebase/firestore.rules deny all) |
| Inventory (what you own), purchases, ratings, match history, events | To decide when we build them: Firestore, or PostgreSQL where money and ownership need transactions | Nothing of this exists yet |
| Card art, table art, avatars, sounds, music | Files behind a CDN (e.g. Cloudflare R2) | Big, cacheable, cheap to serve worldwide |
| Who is at a table | The browser sends its Firebase sign-in token once per connection ("identify"); the seat remembers the account id, saved with the room and never shown to other players | No cookies, so other websites can't act for you |

## 7. Accounts

- **Guest first:** anyone can still play with just a name. An account keeps your progress, stats, items and rank, and a guest can turn into an account without losing the game they're in.
- **Sign-in (built 2026-09-25):** Google, and a sign-in link by email, through Firebase Authentication (Seif's choice). Facebook and phone codes can come later. Accounts are optional: guests play everything.
- **How it fits together:** the page asks `/api/config` whether accounts are on. Firebase's browser code loads only when someone signs in (or was signed in on this browser), so guests don't download it. The server checks sign-in tokens itself against Google's published keys, and reads and writes Firestore through its REST API with its own key. It does not use the Firebase Admin library, which wouldn't fit in the container's 128 MB. Code: `platform/server/src/accounts/`, `platform/web/src/account.ts`.
- **Your profile:** `GET/PUT/DELETE /api/me` with the token in the Authorization header. Deleting removes the profile and the sign-in account at once.
- **Languages:** English, French, Arabic (right to left). The choice is kept in the browser, and on the account when signed in; the account's language follows you to a new device.
- **Local development:** `npm run emulators` runs Firebase's Auth and Firestore emulators on a `demo-` project that can never reach the real one; `npm run test:accounts` tests against them; `platform/web/e2e/accounts.mjs` drives the whole thing in a browser.
- **Privacy:** minimal data, a privacy policy, account deletion. Players in Europe fall under GDPR, and Tunisia has its own personal-data law.

## 8. Customization, personas and voice lines

- **One item system for everything:** card backs, card faces and shapes, table art, player corners, avatars, persona packs, voice lines and emotes are all *items*. You own an item (bought, won, or free) and equip it. The server checks ownership; the other players see what you've equipped.
- **Shared components apply them to every card game at once:** a card back made for Trix works in rami and chkobba, because all card games draw cards through the same component. Table art and corners belong to the room screen, not to one game.
- **Voice lines players trigger:** a quick-chat wheel of prepared lines (text and audio), rate-limited, muteable per player, respecting 18+ settings. No free text chat with strangers at first: moderation is a job of its own.

## 9. Ladders and events

- **Ratings per game:** OpenSkill, a free rating system made for more than two players and for teams (Elo only works one-on-one). Seasons with resets and rewards.
- **Ranked vs private:** ladder points only from ranked tables with strangers, never from private tables (friends could feed each other points). Bots never count.
- **Events:** scheduled tournaments; prizes are items, badges, titles or sponsor gifts. **Never real money** or paid entry with cash prizes: that's gambling law, in Tunisia and in Europe.

## 10. The website

- **One site, one shell:** the home page lists the games. Each game has its own page (create a table, play against bots, how to play). Invite links keep working and open the right game.
- **Each game's screens load only when opened**, so the site stays fast as games are added.
- **One shared kit:** cards, seats, chat bubbles, sounds, settings and the scores panel, so every game looks and feels like the same place and gets cosmetics for free.

## 11. Hosting and operations

- **Before going public:** move off the shared Rheona server (a guest slot capped at 128 MB, next to fleet-critical services) to Trix's own machine. For example an Oracle Always Free ARM machine (up to 4 cores and 24 GB), or a small paid server.
- **What runs there:** Caddy (HTTPS), the Dineri server, backups of the saved tables, uptime monitoring and error tracking. Accounts and profiles live in Firebase (§6–7), not on the machine; a database of our own comes only if purchases or ladders need one.
- **Automation:** tests on every push, and deploy from a tagged release. This needs the GitHub access fixed.
- **Deploys without drama:** today a deploy restarts the server and players see "Reconnecting…" for a second. Later, a new server takes new tables while the old one finishes its games.

## 12. Updating safely

1. Each game has its own version, changelog and tag; every platform change is tested against every game.
2. Saved tables carry their game version; updates restore old saves (tested), or migrate them.
3. A per-game switch closes new tables for a broken game at once, without a deploy; games already running finish.
4. Rollback: one game (restore its folder from its last tag) or everything (the previous server image, as today).
5. The station and the arena run for every game before every deploy.

## 13. The order of work

| Phase | What | Needs |
|---|---|---|
| **1. Restructure (now)** | Platform and `games/trix` layout; the game contract; Trix moved behind it; hub home page and a page per game; per-game TODO, changelog and versions; kill switch; everything tested, nothing different for players | Seif's approval of this document |
| **2. Fun on Trix** | Settings, sounds and music, chat bubbles, personas | `docs/personas.md` approved; lines and audio from Seif |
| **3. Second game** | Chkobba, the contract's first real test | A rules walkthrough with Seif |
| **4. Own server** | Own machine, database, backups, monitoring, automated tests and deploys | A machine; GitHub access fixed |
| **5. Accounts** | Guest-first accounts, profiles, the item system, player personas and voice lines, cosmetics shown at the table | Sign-in providers; privacy policy |
| **6. Ladders and events** | Ratings per game, seasons, ranked tables, tournaments | Enough players to rank |
| **7. Money** | Store, payments, sponsorship | A legal entity and a payment provider |

More games slot in anywhere after phase 3.

## Decisions for Seif

1. **One repository with a folder per game** (section 3), instead of separate repositories. It gives each game its own TODO, history, versions and rollback, without submodules.
2. **One server now, split later** (section 5).
3. **Phase 1 now**, before personas and sounds: it's cheaper now, with one game, than after two.
4. **Own machine before going public** (section 11). Do you have a machine in mind, e.g. your Oracle free account?
