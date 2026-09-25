# Play modes, profiles and matchmaking

**Status: DRAFT for Seif.** The structure and the four decisions marked "Seif, 2026-09-25" come from his answers; the rest is proposed and waits for his approval. Nothing is built from it until then. Game rules stay in each game's `RULES.md` (walkthroughs with Seif).

## 1. Three ways to play

| Mode | What it is | Account | Rating |
|---|---|---|---|
| **Custom room** | The invite-link tables we have: pick the game, its variant and table size; arrange the seats (teams sit across from each other); add bots. The link can be shared anywhere, Discord included, and friends can be invited from the friends list. 2v2 among friends lives here (Seif, 2026-09-25). | Not needed | No |
| **Quick play** | "Find me a table": matched with whoever is looking for the same game, variant and size. After about 30 seconds without enough people, bots fill the empty seats. | Not needed | No |
| **Ranked** | Matched by skill, in a rating per game and mode, with divisions and seasons. Stricter rules about leaving (§5). Never with bots. | Required | Yes |

## 2. The games

| Game | Table sizes | Variants | Ranked |
|---|---|---|---|
| **Chkobba** | 1v1, 2v2 | from the walkthrough | **1v1**, and **2v2 as a duo** (you queue with a friend) |
| **Belote** | 2v2 only | Tunis, Sfax | Later, once its rules are written (Seif is unsure of them for now) |
| **Rami** | 1v1, 2v2 (other sizes: walkthrough) | 61, 71 (harder) | **71 only** (Seif, 2026-09-25); 61 stays casual |
| **Pablo** | any number of players (limits: walkthrough) | – | No: casual among friends |
| **Tekdheb** | several players; one or two decks by player count (walkthrough) | – | No: casual among friends |
| **Trix** | 4, each alone | – | Casual now, ranked later once the system is proven (Seif, 2026-09-25) |

## 3. Matchmaking
1. **A queue per game, variant and size** (Chkobba 1v1, Chkobba 2v2, Rami-71 1v1…). Every queue splits the players, so ranked launches with **Chkobba 1v1 and Chkobba 2v2** only; others open when there are players to fill them.
2. **Ranked 2v2 is duo only at first** (Seif, 2026-09-25): you form a party with a friend and queue together; pairs play pairs. Queueing alone for a random partner comes later, when enough people are online; then the matchmaker puts pairs against pairs and solos against solos wherever it can.
3. **Skill first, then speed:** a search starts close to your rating and widens the longer you wait, so nobody waits forever. The screen shows how many are playing and searching.
4. **When few are online:** quick play fills seats with bots; ranked shows a list of open challenges anyone can accept (like Lichess), so a quiet evening still finds a game.
5. **One place in a queue at a time**, and none while seated at a table.

## 4. Ratings, divisions, seasons
- **Rating:** OpenSkill (an open rating system that handles one-on-one and teams alike; free to use, unlike TrueSkill). One rating per player per ranked queue. In 2v2 a pair's result updates each player's own rating; the pair's record is kept too.
- **Placement:** the first 5 games of a queue place you; until then your rating is provisional.
- **Divisions:** tiers drawn from the rating, shown on your profile and at the table. **Their names are Seif's to choose.**
- **Seasons:** a few months each (length: Seif's call), ending with a soft reset toward the middle and a reward that stays on your profile (a badge, a card back).

## 5. Leaving a game
- **Casual** (custom rooms, quick play): as today. The table pauses, you can come back to your seat, a bot can stand in, the owner decides.
- **Ranked:** you have 2 minutes to reconnect while a bot holds your seat. After that, the game counts as a loss for you only; your partner in 2v2 loses no rating. Leaving again and again means a growing wait before you can queue.

## 6. Profiles and friends
- **Profile:** a unique **handle** (@seif), your name at the table, later an avatar; per game your rating, division, stats and recent games.
- **Friends** (Seif, 2026-09-25: handle and friend link): add someone by handle, or send your **friend link** (easy to paste into Discord). See who is online or in a game. Invite a friend to a custom room, or into a **party** to queue together. Block someone.
- **Guests** keep playing custom rooms and quick play; an account is needed for friends, parties and ranked.

## 7. How it fits the platform
- **Accounts already exist** (Firebase, optional). Handles, friends, parties, ratings, match history and seasons are stored in Firestore, written only by the server, like profiles today.
- **Who is online:** the server already knows which account is connected ("identify"), so presence and invites travel over the game connection.
- **Teams:** a game declares its team layout (two teams, partners across); the platform handles team seating in the lobby, team scores and bots standing in for their team. Every game with teams gets it at once.
- **Machine:** ranked play makes a dedicated machine (TODO, Open: own machine before going public) more pressing: people care when rated games break.

## 8. Order of work
1. **Profiles and friends:** handles, friend requests and links, presence, invites, parties. Custom rooms gain variants and team seating.
2. **Quick play:** open challenges plus automatic matching, bots filling seats.
3. **Ranked:** ratings, placement, divisions, seasons, leaving rules; first with Chkobba 1v1 and 2v2 duo.

Rules walkthroughs (Chkobba first) run alongside; accounts go live once Seif's Firebase steps are done (TODO, Open 1).

## 9. Questions for Seif
1. Do you approve this structure (the three modes, the order of work)?
2. Division names, and the length of a season.
3. From the walkthroughs: Chkobba's variants, Rami's other table sizes, Pablo's player limits, Tekdheb's deck rule, Belote Tunis and Sfax.
