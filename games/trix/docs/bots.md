# Bots: how they behave (spec)

**Status: APPROVED by Seif, 2026-09-24**, including section 3 (picking) and the five decisions at the end as written. **Built 2026-09-24** (`games/trix/engine/src/bots/`, RULES.md R-BOT-3); results in [bots-arena.md](bots-arena.md). Changes after this need Seif's OK.

**Goal:** someone can play a whole game alone against 3 bots, at one of three levels: **easy**, **medium**, **hard**. Bots can also fill seats at a table of friends, as they do today.

## 1. Ground rules for every level

1. **Bots never cheat.** A bot decides only from what a human in its seat could know:
   - its own hand;
   - the table as the player sees it (the current trick, card counts, tricks won, trix stacks, scores, contracts used);
   - everything that happened in public while it sat there: every card played, every pass, every K♥ declaration.

   It never sees other hands, won piles or the shuffle. The code enforces this: the bot is only given the player's view and the public events, never the game state.
2. **The levels differ in skill and memory, not in information.** Remembering every card played is fair: a human with a good memory or a notepad knows the same.
3. **Legal moves only**, from the engine (R-BOT-1).
4. **Same pace as now:** about 1 s per card and 1.4 s per pick, so the table feels the same at every level.
5. **Hard has a thinking budget.** It may think for at most **30 ms per move**. The server shares a machine with the Rheona fleet, and its 1-CPU cap means heavy bot load slows only Trix down.

## 2. The three levels at a glance

| | Easy | Medium | Hard |
|---|---|---|---|
| **Feels like** | a beginner who knows the rules | a decent club player | a strong, patient player |
| **Memory** | only the current trick | every card played this contract | everything, and it works out who is out of which suit |
| **Picking a contract** | **random** among the contracts it may pick | **reads its hand:** the contract this hand is safest in | **reads its hand and plans:** the contract where this hand is best compared with an average hand, planned across all 7 picks, the trix deadline and the scores |
| **Playing** | simple rules per trick; about 1 move in 4 is a random legal move | rules for each contract, using what's still out | imagines 40 possible deals of the hidden cards, plays each card forward, and picks the card that costs least on average |
| **Declaring K♥** | never | when it can likely get rid of it (see §5) | when the simulations say declaring pays |
| **Plays the scoreboard** | no | no | yes: avoids feeding the exact-1000 reset, pushes the leader when it helps (see §7) |
| **Mistakes** | often | rarely | none on purpose |

## 3. Picking a contract (reading the hand)

This is the first decision of every contract, made after seeing the hand (R-DECK-3), and it shapes the whole game. Today's placeholder bot ignores its cards and just goes down the list (dineri, damet, pli, …). All three levels replace that.

**Easy: random.** A random contract among the ones it may pick. The rules still apply: trix needs a jack (R-GAME-4) and is due by the 6th pick (R-GAME-11).

**Medium: reads its hand.** For each contract it may pick, it estimates how many points this hand would take, and picks the lowest (its own score counts ×2 as picker). What makes a hand dangerous or safe:

| Contract | Dangerous hand | Safe hand |
|---|---|---|
| dineri | many ♦, high ♦ (A, 10, K) without low ♦ to duck with; high cards elsewhere that win tricks others can dump ♦ on | few ♦, all low; voids to throw ♦ into |
| damet | a Q without lower cards of its suit to duck with; A, 10, K in a suit whose Q is out | no queens, low cards, short suits |
| pli | high cards (A, 10), long suits of high cards, no voids | low cards, especially 7s, 8s and 9s |
| farcha | no low cards to keep for the end; one long suit (whoever leads trick 8 often has to win it) | a few low cards to keep for the last trick, high cards to spend early |
| ray | K♥ with few other hearts and no escape suit; A♥ or 10♥ with several hearts (they take the K♥) | no K♥, no A♥ or 10♥, short hearts |
| general | all of the above at once | only a very low hand is safe |
| trix | isolated 7s and aces far from any jack; no aces | jacks, aces (extra turns), runs next to a jack |

Two planning habits on top:
- it doesn't let general become its ×4 last pick: from the 5th pick on, general goes first unless the hand is terrible for it;
- it uses trix on a bad hand, before the deadline forces it (R-GAME-11).

**Hard: reads its hand and plans.** It makes the same estimate as medium, but asks a better question: *how much better is this hand for each contract than an average hand would be?* It spends each contract where it gains most, because every contract has to be picked some time. Example: a hand safe for both dineri and pli, where most hands are fine for pli anyway, so it spends dineri now. It also plans around:
- the ×4 on its last pick (it keeps a contract that is safe for most hands for the end);
- the trix deadline;
- its score against 1000 (§7).

**A worked example.** Hand: A♠ 10♠ K♠ · 7♦ 8♦ · J♥ · 9♣ 7♣.
- *pli:* bad. The three top spades will probably win three tricks.
- *general:* bad for the same reason, with ♦ and queens on top.
- *damet:* risky. No queens, but the spade winners can collect a Q♠ or a queen someone throws away.
- *dineri:* fairly safe. Only 7♦ and 8♦, which almost never win a diamond trick. The risk is others throwing ♦ on its spade winners.
- *farcha:* safe. It can spend the spades early and keep 7♣ or 7♦ for the last trick.
- *ray:* moderate. No K♥ and a single heart, but someone void in spades could throw the K♥ on one of its spade winners.
- *trix:* weak. One jack, and 7s far from it.

So easy picks anything, medium picks farcha or dineri (whichever its estimate says is lower), and hard asks which of the two most hands are *worse* at. Most hands can plan a low card for farcha, fewer hands are this safe for dineri, so it takes dineri now and keeps farcha for later.

## 4. Playing tricks

**Easy**, one trick at a time:
- following suit: play the highest card that still **loses** the trick; if every card would win, play the highest (it's lost anyway);
- void in the led suit: throw away the card that's most dangerous in this contract (K♥ in ray, a queen in damet, a high ♦ in dineri, otherwise its highest card);
- leading: lead its lowest card;
- about 1 move in 4 is a random legal move instead.

**Medium** follows those rules without the random moves, and adds what's still out, contract by contract:

| Contract | Medium's extra rules |
|---|---|
| dineri | never takes a trick with ♦ in it if it can avoid it; unloads high ♦ when void; wins a *clean* trick (no ♦) when that gets rid of a dangerous high card |
| damet | protects its own queens by ducking; unloads queens when void; avoids winning a trick while a queen of that suit is still out |
| pli | ducks whenever it can; unloads A and 10 when void |
| farcha | early tricks are free: gets rid of high cards early and keeps low cards for trick 8; tries to be void somewhere, so it can't be forced to win the last trick |
| ray | with K♥: gets void in hearts, then throws K♥ on another suit; with A♥ or 10♥: plays them only when K♥ is gone or can't fall in that trick; leads hearts to flush a declared K♥ |
| general | protects against the biggest danger first: K♥, then queens, then ♦, then tricks, then the last trick; a sweep attempt (all 8 tricks → 0, R-GEN-3) only with a hand that's almost all top cards |
| trix | when it has a choice: plays cards that open its own next cards, and holds back cards that others are waiting for; plays aces for the extra turn; opens with the jack whose suit it holds most of |

**Hard:** for each legal card, it imagines **40 deals** of the hidden cards consistent with everything it knows:
- the cards already played;
- who is out of which suit;
- the known K♥ holder after a declaration.

It plays each deal to the end of the contract with the medium rules for everyone, and picks the card with the lowest average cost to itself (§7 says what "cost" means). If the 30 ms budget runs out, it uses the samples it has; with none, it plays as medium.

## 5. Declaring K♥ (ray, and general)

- **Easy:** never.
- **Medium:** declares when it holds K♥ with **at most one other heart**, holds **neither A♥ nor 10♥**, and has a void or a short suit to escape through. Otherwise it doesn't.
- **Hard:** declares when its simulations say declaring has the lower expected cost. That includes the −50 when someone else takes the K♥, and the +200 (×2 or ×4 as picker) when it's stuck with it.

## 6. Looking at the last trick (R-TRICK-6)

Bots don't use the 2 looks. Medium and hard already remember every card, and easy wouldn't use them.

## 7. Hard plays the scoreboard (the game is about not losing)

Hard doesn't just count its own points. For a move or a pick, its "cost" is its own points, adjusted by:
- **Going over 1000:** being the one who goes over 1000 is very expensive (it loses the game), so near 1000 it plays extra safe.
- **Exactly 1000:** when a player needs an exact number to land on 1000 (and reset to 0), hard avoids handing them exactly that. When hard itself can land on exactly 1000, it values that as a comeback.
- **The leader:** when the player with the highest total is close to going over and hard is not the lowest, hard is happy to give them points. That ends the game while hard isn't last.

No level ever teams up with a particular player; each bot plays for itself.

## 8. Where levels are chosen (screens)

- **Play alone:** a new button on the first screen, **Play against bots**, with the level (Easy / Medium / Hard). It creates a table, fills 3 seats with bots of that level and starts at once. The invite link still works, so a friend can take over a bot's seat (R-TABLE-10).
- **With friends:** in the lobby, the owner's **Add a bot** button offers the three levels.
- **Stand-in bots** (a friend disconnected and the owner plays on, R-TABLE-7) play at **medium**.
- Bots are named after their level, e.g. **Easy bot**, **Medium bot 2**, **Hard bot**.

## 9. How we know it works

1. **Arena:** a new tool, `npm run arena`, that plays thousands of complete games inside the engine (no server, seconds per thousand games) with mixed levels, and reports average place, win rate and points per contract, with error margins. Acceptance:
   - one hard vs three medium: hard wins clearly more than its share (25%) and finishes last clearly less than its share;
   - one medium vs three easy: the same;
   - one easy vs three placeholder bots: easy is not worse (a sanity check that "easy" is still a real player).
2. **No-cheating test:** two games that differ only in the *other* players' hands must give the same bot decision (with the same random seed).
3. **Speed:** hard's thinking time is measured in the arena; 99% of moves under 30 ms.
4. **The station** keeps running every scenario with bots at the table, and its referee checks every bot move.
5. **Seif plays** a game at each level and says whether it feels right.

## Decisions (approved 2026-09-24 as written)

1. **No cheating at any level (§1).** Recommended. The alternative would be a "hard" bot that peeks at hands, which is easy to build but unfair.
2. **Stand-in bots at medium (§8).** Or should they use the level of the other bots at the table?
3. **Easy's randomness: random picks (§3), and 1 random card in 4 (§4).** Too dumb, or about right?
4. **Hard plays the scoreboard (§7).** Keep it, or have hard only minimise its own points?
5. **Anything here that doesn't match how your group actually plays.** Especially the medium rules in §4. They're the base for hard too, so they matter most.
