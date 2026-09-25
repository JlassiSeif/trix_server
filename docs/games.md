# The games: what each one needs

One page for every game on Dineri: what we know, what Seif has decided, what's done, and what's left. How games are played and ranked is in [play-modes.md](play-modes.md) (DRAFT); how they look, in [game-look.md](game-look.md); how one gets built, in [adding-a-game.md](adding-a-game.md). The home page's list comes from `platform/web/src/games.ts`, in this order.

**No game is built before its rules are written with Seif and approved** (`games/<game>/RULES.md`), because Tunisian tables have their own variants.

## 1. At a glance

| # | Game | Players | Variants | Modes (Seif, 2026-09-25) | Rules | Icon | Status |
|---|---|---|---|---|---|---|---|
| – | **Trix** | 4, each alone | – | casual; ranked later | ✅ approved | ✅ | **Live**, 1.1.0 |
| 1 | **Chkobba** | 1v1, 2v2 | walkthrough | casual; ranked 1v1 and 2v2 duo | waiting for Seif | ✅ | next |
| 2 | **Rami** | 1v1, 2v2 (more: walkthrough) | 61, 71 (harder) | casual; ranked 71 only | waiting for Seif | ✅ | next |
| 3 | **Belote** | 2v2 only | Tunis, Sfax | casual; ranked later | later (Seif unsure) | ✅ | later |
| 4 | **Pablo** | any number | – | casual among friends | waiting for Seif | ✅ | next |
| 5 | **Tekdheb** | several; one or two decks by count | – | casual among friends | waiting for Seif | ✅ | next |
| 6 | **Dominos** | walkthrough | walkthrough | casual (ranked: to decide) | Seif checking | ✅ | quick |
| 7 | **Dama** | 1v1 | walkthrough | casual (ranked: to decide) | Seif checking | ✅ | quick |
| 8 | **Kharbga** | 1v1 | walkthrough | casual (ranked: to decide) | Seif checking | ✅ | quick |
| 9 | **The goose game** | 2 or more | – | casual | Seif sends them | ✅ | quick |
| 10 | Loup garou | a group | – | casual | – | ✅ | wanted |
| 11 | Bent w wled | ? | – | – | – | placeholder | wanted: **what is it?** |
| 12 | Jhayech | ? | – | – | – | placeholder | wanted: **what is it?** |

Also wanted, with our own names and twists (trademarks): an Uno-style game, a Monopoly-style game.

## 2. What each game needs

Every game follows the same steps (adding-a-game.md): **rules** → **engine** (tests per rule, fuzz run) → **bots** → **table screen** (house style) → **icon** into its package → station/browser tests → release. Below: what's particular to each.

- **Chkobba:** 40-card deck (ace to 7, and J Q K). Captures by match or by sum, sweeps (*chkobba*), end-of-round scoring. **Needs teams** (2v2) and **two-seat tables** (1v1). Bots: capture choice and counting cards left, a good fit for the Trix bots' approach.
- **Rami:** two decks with jokers. Melds on the table, an opening minimum (61 or 71), jokers. **Needs variants per table** (61/71), **teams** (2v2), two-seat tables. The biggest engine of the lot; bots need meld search.
- **Belote:** 32 cards (same as Trix), trumps, bidding. **Needs teams** and **variants** (Tunis, Sfax). Reuses much of Trix's trick-taking engine and bot ideas.
- **Pablo** (as commonly played; the walkthrough decides): four face-down cards each, peeking, swapping, calling "Pablo". **Needs tables of any size** (the owner starts when enough have joined). Secrets per player fit the engine as-is (each seat sees only its own view).
- **Tekdheb** (assumed from its name, "you're lying"; the walkthrough decides): cards played face down with a claim, and calling a lie. Its icon shows that too, and changes if the game is different. One or two decks by player count. **Needs tables of any size.** The bots need to bluff and to judge bluffs.
- **Dominos:** tiles instead of cards. **Needs a tile set** (drawn in the house style) and possibly teams (walkthrough).
- **Dama:** an 8×8 or 10×10 board (walkthrough). **Needs a board and pieces** in the house style, two-seat tables. Everything is visible, so strong bots come from a plain search.
- **Kharbga:** a square board with stones (walkthrough). **Needs a board**, two-seat tables. Same bot approach as Dama.
- **The goose game:** a track and dice. **Needs dice** and a board; tables of any size. No real bot decisions.
- **Loup garou:** roles, night and day phases, voting, a narrator. A party game, unlike the others; later.

## 3. Platform pieces, and which games wait on them

| Piece | Status | Games |
|---|---|---|
| Shared card deck | ✅ done (2026-09-25), `platform/ui/src/cards.ts`: the full deck (52 faces, both jokers) in the 2023 style Seif prefers (Aisleriot's original "bonded" deck; the jokers carry the GNOME foot) | Trix, Chkobba, Rami, Belote, Pablo, Tekdheb |
| Dineri's card back | ✅ done | all card games |
| Game icons | ✅ done: in each game's description, on the home page's cards, the game page and the lobby | all |
| Teams (partners across, team seating, team scores, bots standing in for their team) | spec in play-modes.md, waiting for approval | Chkobba 2v2, Rami 2v2, Belote, maybe Dominos |
| Two-seat tables | the game contract allows it (`seats: {min, max}`); needs the lobby and a table layout tested with two | Chkobba, Rami, Dama, Kharbga |
| Tables of any size (start when enough have joined) | to build: the owner starts the game with the seats filled so far | Pablo, Tekdheb, the goose game, Loup garou |
| Variants chosen per table | to build: a variant picked on the game's page, kept with the room | Rami (61/71), Belote (Tunis/Sfax), others from their walkthroughs |
| Dice | to build (seeded on the server, like the deal) | the goose game |
| Tiles, boards and pieces in the house style | to build when their rules arrive | Dominos, Dama, Kharbga, the goose game |
| Profiles, friends, parties, quick play, ranked | spec in play-modes.md, waiting for approval | all |

## 4. The order
1. **Done now (2026-09-25):** icons for every game, the full shared deck in the 2023 style, this plan and the list in one place.
2. **Waiting on Seif:** the rules (Chkobba, Rami, Pablo, Tekdheb, the goose game; Dominos, Dama, Kharbga after his check; Belote later), approval of play-modes.md, and what Bent w wled and Jhayech are.
3. **Then, platform first:** teams, two-seat tables, tables of any size and variants, proven with the test-only game before a real game depends on them.
4. **Then the games,** in the order Seif's rules arrive, Chkobba first.
