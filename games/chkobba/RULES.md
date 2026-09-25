# Chkobba: rules

**Status: DRAFT for Seif, 2026-09-25.** Written from Seif's reference, the French Wikipedia article [Chkobba](https://fr.wikipedia.org/wiki/Chkobba) (quoted where it matters). Nothing is built from it until Seif approves it. Every rule has an ID that the engine's tests will cite; lines marked **Q** are questions for Seif, where the article is silent or unclear. Tunisian tables have their own habits: what Seif says wins over the article.

## 1. The cards
- **R-DECK-1:** 40 cards in four suits: ♦ (*dīnārī*), ♥, ♠, ♣. Each suit: ace to 7, and the queen, jack and king. The cards have no numbers, only the suit's symbols (the Chkobba deck, `platform/ui`: Seif, 2026-09-25).
- **R-DECK-2:** Values: ace 1, 2 to 7 as marked, **queen 8, jack 9, king 10** (as the article gives them: *dame* 8, *valet* 9, *roi* 10).
- **R-DECK-3:** The 7♦ is *sabʿa l-ḥayya*, the most important card (R-SCORE-4).

## 2. Players
- **R-SEAT-1:** Two players, one against one; or four, in two teams of two, partners sitting across from each other. **Q1:** In 2v2, does play go round the table (you, opponent, partner, opponent)? Which direction? Do partners share one pile of captured cards?
- **R-SEAT-2:** **Q2:** The article says three or four can also play each alone. Do we offer that, or only 1v1 and 2v2?

## 3. The deal
- **R-DEAL-1:** The dealer shuffles; the other player cuts and draws a card. They may **keep it** or **put it on the table**.
  - Kept: the dealer gives them two more, takes three, and lays four on the table.
  - Put on the table: the dealer adds three to the table, then gives three to the other player and three to themselves.

  In the end: 4 cards on the table, 3 in each hand. **Q3:** Online, do we keep this choice (the player who cuts decides where the drawn card goes), or simply deal 3 each and 4 to the table?
- **R-DEAL-2:** "If three cards of the same value are on the table after the deal, the deal is done again." **Q4:** Three exactly, or three or more? Also on later deals of the round, or only the first?
- **R-DEAL-3:** When both hands are empty, the dealer deals three more cards each (none to the table), until the pack runs out. With two players that makes six hands of three per round (*manche*).
- **R-DEAL-4:** The dealer changes every round (it alternates). **Q5:** In 2v2, who deals next: the next player round the table?

## 4. Playing
- **R-PLAY-1:** The player who cut plays first ("the drawer throws the first card").
- **R-PLAY-2:** On your turn you play one card. You cannot pass.
- **R-PLAY-3:** **Capturing by value:** a card takes a card of the same value on the table.
- **R-PLAY-4:** **Capturing by sum:** a card takes several table cards that add up to its value (a queen, 8, takes a 7 and an ace).
- **R-PLAY-5:** "If a card allows both, taking the card of the same value comes first." **Q6:** If several sums are possible (a king, 10, with 3+7 or 4+6 on the table), the player chooses which, as long as there's no equal card?
- **R-PLAY-6:** Capturing is **not compulsory**: "if you can take with one of the cards in your hand, you don't have to play it first." You may play another card instead, which then stays on the table. **Q7:** And when the card you play *could* take something, may you lay it on the table without taking?
- **R-PLAY-7:** Captured cards go face down on your pile.

## 5. The chkobba
- **R-CHK-1:** Whenever a capture empties the table, the player scores **1 point** (a *chkobba*). The capturing card is placed face up in their pile to count it.
- **R-CHK-2:** "There is no chkobba at the end of the last turn of a round."

## 6. End of a round
- **R-END-1:** Cards still on the table after the last turn go to whoever made the last capture (no chkobba for it, R-CHK-2).

## 7. Scoring a round
Four points, plus the chkobbas:
- **R-SCORE-1:** ***Kārṭa***: 1 point for the most cards. A tie: nobody scores.
- **R-SCORE-2:** ***Dīnārī***: 1 point for the most ♦. A tie: nobody scores.
- **R-SCORE-3:** ***Barmīla***: 1 point for the most 7s; if tied, the most 6s; if still tied, nobody scores.
- **R-SCORE-4:** ***Sabʿa l-ḥayya***: 1 point for holding the 7♦.
- **R-SCORE-5:** Each chkobba: 1 point (R-CHK-1).
- **R-SCORE-6:** A tied point is declared *bājī*: nobody scores it.

## 8. Winning
- **R-GAME-1:** The first to reach at least **11, 21 or 31**, chosen before the game, wins. **Q8:** Who chooses online: the table's owner, when creating the table? And ranked: which one?
- **R-GAME-2:** **Q9:** If both reach the target in the same round, who wins: the higher score? And if equal?
- **R-GAME-3:** **Q10:** Is the count done only at the end of a round, or does a player win the moment they reach the target (for example with a chkobba)?

## Changelog
- 2026-09-25: first draft from the French Wikipedia article, for Seif's review.
