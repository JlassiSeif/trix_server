# Trix: rules (the spec)

**Status: APPROVED by Seif, 2026-09-23.** Any change after this needs Seif's OK and a dated note in the changelog at the bottom.
Sources: [docs/rules-input.md](docs/rules-input.md) (Seif's description, verbatim) plus the Q&A of 2026-09-23.
The engine implements only what's written here. Every rule has an ID that the tests cite. Points marked **OPEN** are undecided and must not be implemented until they're answered.

## Glossary
- **Game:** the whole match, from the first contract until someone is out or all contracts are played.
- **Contract:** one of the 7 mini games, played with one deal of the cards.
- **Picker:** the player who chose the current contract.
- **Trick (pli):** 4 cards, one from each player.
- **Won pile:** the cards a player has taken in tricks during the current contract.
- **Score:** points are bad. The lowest total wins.

## 1. Deck and cards
- **R-DECK-1:** 32 cards: 7, 8, 9, 10, J, Q, K, A in ♥ ♣ ♦ ♠.
- **R-DECK-2:** Rank, lowest to highest: **7 8 9 J Q K 10 A**. The same order is used for tricks and for the trix stacks.
- **R-DECK-3:** Every contract starts with a fresh shuffle and deal, 8 cards each. The deal happens **before** the pick, so the picker chooses after seeing their hand.

## 2. Seats and turn order
- **R-SEAT-1:** 4 players in fixed seats. All turn order (picking, playing cards, trix turns) goes **counter-clockwise**.
- **R-SEAT-2:** The first picker of the game is chosen at random.

## 3. Game structure
- **R-GAME-1:** Each player has their own set of 7 contracts: `dineri`, `damet`, `pli`, `farcha`, `ray`, `general`, `trix`. A player can pick each of their own contracts once. What other players have picked doesn't matter.
- **R-GAME-2:** The picker moves counter-clockwise after every contract. So there are at most 4 × 7 = **28 contracts**, and each player's 7th pick is forced (it's the only one they have left).
- **R-GAME-3:** Each contract runs: deal → the picker chooses one of their unused contracts → play → score.
- **R-GAME-4:** A player may pick `trix` only if they hold at least one jack.
- **R-GAME-5:** Exception: if `trix` is forced on a player (R-GAME-11) and they hold no jack, trix is still played. The first jack is placed by the next player counter-clockwise who holds a jack (see R-TRIX-2).
- **R-GAME-6:** After each contract, its scores are added to the running totals. Then:
  1. Any total of **exactly 1000** is reset to **0**.
  2. If any total is **strictly over 1000**, the game is over.
- **R-GAME-7:** The game also ends after the 28th contract.
- **R-GAME-8:** Totals can go negative (through trix).
- **R-GAME-9:** At the end of the game, the lowest total wins and the highest total loses. Equal totals are ties, with no tie-breaker.
- **R-GAME-10:** The result screen puts the **loser** front and centre (the player who went over 1000, or otherwise the highest total), with the winner second.
- **R-GAME-11:** **Trix is due by your 6th pick.** If a player's 6th pick comes and `trix` is still unused, trix is their only choice for that pick, with or without a jack (without one, R-GAME-5 applies). So trix is never a 7th pick, and the ×4 of R-MULT-2 always falls on a trick contract.

## 4. Trick play (every contract except trix)
- **R-TRICK-1:** The picker leads the first trick.
- **R-TRICK-2:** You must follow the led suit if you can. Otherwise you may play any card. There is no other obligation (you don't have to play higher).
- **R-TRICK-3:** The highest card of the led suit wins the trick. There are no trumps, and a card of another suit never wins.
- **R-TRICK-4:** The winner of a trick leads the next one.
- **R-TRICK-5:** A won trick goes to the winner's won pile, and contracts are scored from the won piles.
- **R-TRICK-6:** Completed tricks are face down: players see only how many tricks each player has won. Each player may look at the **last completed trick** up to **2 times per contract**. Assumed until Seif says otherwise: a player can look at any moment during a trick contract (not only on their turn), and the look shows the 4 cards and who played each.

## 5. Multipliers
- **R-MULT-1:** The **picker's** score for their contract is **×2**, including bonuses. Other players' scores are not multiplied.
- **R-MULT-2:** For a player's **7th (forced) pick**, their score is **×4** instead of ×2.
- **R-MULT-3:** Multipliers never apply to `trix`.
- **R-MULT-4:** The ray declarer's −50 (R-RAY-6) is never multiplied. So the picker's score = (card points + bonuses) × multiplier, then the −50 is added if it applies.

## 6. Contracts

### Dineri (diamonds)
- **R-DIN-1:** +10 for each ♦ in a player's won pile.
- **R-DIN-2:** A player who takes all 8 ♦ scores **+150 instead of 80**.
- **R-DIN-3:** The contract ends after the trick in which the last ♦ is taken.

### Damet (queens)
- **R-DAM-1:** +20 for each queen in a player's won pile.
- **R-DAM-2:** The contract ends after the trick in which the last queen is taken. There is no bonus for taking all 4.

### Pli (tricks)
- **R-PLI-1:** +10 for each trick won. All 8 tricks are played.
- **R-PLI-2:** A player who wins all 8 tricks scores **+150 instead of 80**.

### Farcha (last trick)
- **R-FAR-1:** All 8 tricks are played. Only the 8th trick counts: whoever wins it scores +100.

### Ray (king of hearts)
- **R-RAY-1:** Whoever takes the trick containing K♥ scores +100.
- **R-RAY-2:** The contract ends after that trick.
- **R-RAY-3:** **Declaration.** The player holding K♥ may declare it on their first turn of the contract, before playing their first card. Declaring is optional: playing a card without declaring means they chose not to.
- **R-RAY-4:** If K♥ was declared, whoever takes it scores **+200** instead of +100, including the declarer themselves.
- **R-RAY-5:** There is no special obligation to play K♥. Normal follow-suit applies: if hearts is led and K♥ is the holder's only heart, they must play it.
- **R-RAY-6:** If K♥ was declared and **someone else** takes it, the declarer scores **−50**. This −50 is **never multiplied**, even when the declarer is the picker. It is added after the multiplier (R-MULT-4).

### General (everything at once)
- **R-GEN-1:** Dineri, damet, pli, farcha and ray are all scored together in one contract, including their special rules (R-DIN-2, R-PLI-2, R-RAY-3 to R-RAY-6).
- **R-GEN-2:** There is no early ending: all 8 tricks are always played (farcha needs the 8th).
- **R-GEN-3:** A player who wins **all 8 tricks** (and so collects every point of all 5 contracts) scores **0** for the contract, overriding everything else.

### Trix (stacking; the only contract that lowers scores)
- **R-TRIX-1:** There are 4 stacks on the table, one per suit. Each stack starts with its jack and builds **up J→Q→K→10→A** and **down J→9→8→7**.
- **R-TRIX-2:** The picker places the first card, choosing which of their jacks. In the forced case with no jack (R-GAME-5), the first counter-clockwise player holding a jack places the first jack, and the players before them pass.
- **R-TRIX-3:** Turns then go counter-clockwise. A legal play is either:
  - a jack of a suit whose stack hasn't started yet, or
  - the next card up or down on a stack that has started.
- **R-TRIX-4:** A player must play if they have any legal card (a jack counts). They pass only when they have no legal card.
- **R-TRIX-5:** Placing an **ace** gives an immediate extra turn. If the player then has no legal card, they pass.
- **R-TRIX-6:** The first player to empty their hand scores **−100**, and the second scores **−50**. Play stops as soon as the second player finishes, and the other two score 0.
- **R-TRIX-7:** No multipliers (R-MULT-3).

## 7. Table (online play)
- **R-TABLE-1:** One table of 4. A room is joined through an invite link; each player picks a name and takes a seat.
- **R-TABLE-2:** The player who creates the room is the **room owner**.
- **R-TABLE-3:** The game starts **automatically** as soon as the 4th player is seated.
- **R-TABLE-4:** If a player **disconnects** mid-game (network drop, closed tab), the table **pauses** until they come back.
- **R-TABLE-5:** A disconnected player who returns (reopens the link in the same browser) takes their seat back immediately (same hand, score and remaining contracts), even if the bot is playing it.
- **R-TABLE-6:** A player can **leave** the table, and the room owner can **kick** any player at any time. Both are handled the same way:
  1. The seat becomes empty, and the table pauses.
  2. A **new invite link** is generated, and the old link stops working. The player who left or was kicked cannot reclaim the seat.
  3. The room owner copies the new link and sends it to whoever should take the seat.
- **R-TABLE-7:** While the table is paused (a disconnect or an empty seat), the room owner can:
  1. **Wait for a replacement:** a new person joins through the invite link and takes over the empty seat (its hand, score and remaining contracts), and the game resumes.
  2. **Resume without waiting:** the missing seat is played by a **medium** bot (R-BOT-3) until someone takes it.
  3. **End the game.**
- **R-TABLE-8:** After the game ends, each player can click **Ready**. The next game starts when all 4 are ready. Seats stay the same, and the first picker is random again (R-SEAT-2).
- **R-TABLE-10:** Before the game, the room owner can fill empty seats with **bots**, choosing each bot's level (easy, medium or hard, R-BOT-3). A friend joining later through the invite link takes over a bot's seat. *(Added for v0.5 so Seif can test with bots; Seif to confirm. Levels added 2026-09-24 with the approved bot spec.)*
- **R-TABLE-11:** When a contract ends, everyone sees a score summary. The next deal starts when every human clicks **Continue**, or after **10 seconds**. *(Claude's design call under Seif's "up to good game design"; Seif to confirm.)*
- **R-TABLE-12:** **Room ownership passes on.**
  1. If the owner **leaves**, or is **disconnected for 30 seconds**, ownership passes to the next connected player (counter-clockwise from the owner).
  2. The owner can **hand ownership** to any other connected player at any time.
  3. Ownership only ever goes to a person who is connected right now, never to a bot. If nobody is connected, it passes as soon as someone is.
  4. A previous owner who comes back does **not** get it back automatically; the current owner can hand it back.
- **R-TABLE-13:** **Play against bots.** From the first screen, a player can start a table against three bots of one level (easy, medium or hard). The game starts at once. The invite link still works, so a friend can take over a bot's seat (R-TABLE-10).
- **R-TABLE-14:** **Playing a card, and premoves** (Seif, 2026-09-25, "like chess.com").
  1. On your turn, play a card by tapping it or by dragging it onto the table.
  2. **Premove:** before your turn, tap or drag a card to choose it in advance. Only you see it. When your turn comes it's played at once, if it's legal then. If it isn't (for example a suit was led that you still hold), it's cancelled, the card stays in your hand, and you're told.
  3. One premove at a time. Tap it again, tap the table or right-click to cancel it; choosing another card replaces it. A premove ends with the contract.
  4. A card that surely can't be played on your turn (the suit led is already known and you hold that suit) can't be premoved.
  5. In ray and general, a premoved first card plays like any other: playing without declaring means you chose not to declare K♥ (R-RAY-3).
  6. It works the same in the trix contract (placing a card on a stack).
- **R-TABLE-9:** The interface speaks **English, French and Arabic** (Arabic right to left), chosen by each player (Seif, 2026-09-25). The table itself keeps its layout in every language, so seats go round the same way for everyone. Contracts keep their own names in every language: `dineri`, `damet`, `pli`, `farcha`, `ray`, `general`, `trix`. *(The French and Arabic wording is a first draft for Seif to review.)*

## 8. Bots
- **R-BOT-1:** A bot only ever makes legal moves, using the same engine rules as a human player.
- **R-BOT-2:** *(Replaced 2026-09-24 by R-BOT-3.)* The placeholder bot picked the first allowed contract in the order `dineri, damet, pli, farcha, ray, general, trix`, played its lowest legal card, and never declared K♥. It remains only as the server's fallback if a bot ever fails to choose a legal move.
- **R-BOT-3:** Bots play at one of three levels, **easy**, **medium** or **hard**, as specified in [docs/bots.md](docs/bots.md) (approved by Seif 2026-09-24). A bot knows only what a player in its seat could know: its own hand and everything that happened in public. Stand-in bots (R-TABLE-7) play at medium.

## Changelog
- 2026-09-23: Approved by Seif. On approval: leaving and being kicked generate a new invite link (R-TABLE-6), and the bot is a placeholder (R-BOT-2).
- 2026-09-23: Seif added R-TRICK-6 (look at the last trick twice per contract). The exact moments when a look is allowed are assumed and marked as such.
- 2026-09-23: v0.5 added R-TABLE-10 (bots in the lobby) and R-TABLE-11 (score summary, Continue or 10 s). Both are Claude's design calls, awaiting Seif's confirmation.
- 2026-09-23: Seif added R-TABLE-12 (ownership passes after the owner leaves or is away 30 s, can be handed over, connected players only, no automatic return).
- 2026-09-24: Seif added R-GAME-11 (trix is due by the 6th pick), so trix can no longer be kept for the 7th pick to escape its ×4. R-GAME-5 now refers to it.
- 2026-09-24: Bots built to the approved spec (docs/bots.md): R-BOT-3 replaces the placeholder (R-BOT-2); R-TABLE-10 gains bot levels; R-TABLE-7's stand-in plays at medium; R-TABLE-13 added (Play against bots, spec §8).
- 2026-09-25: R-TABLE-9: English, French and Arabic, as Seif asked for the hub. The rules of play are unchanged.
- 2026-09-25: Seif added R-TABLE-14 (drag and drop, premoves like chess.com): an impossible premove is cancelled with a notice; a premoved first card in ray plays without declaring; tap or drag both work.
