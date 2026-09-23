// Placeholder bot (R-BOT-1, R-BOT-2): legal moves only, no strategy.

import { SUITS, rankIndex, suitOf, type Seat } from "./cards";
import { legalActions, type Action, type GameState } from "./game";

/** The bot's move for this seat, or null if the seat has nothing to do right now. */
export function placeholderBotAction(state: GameState, seat: Seat): Action | null {
  const legal = legalActions(state, seat);
  // Contracts come back in CONTRACTS order, so the first is the bot's preference.
  const pick = legal.find((a) => a.type === "pick");
  if (pick) return pick;
  // Lowest legal card; never declares K♥.
  const plays = legal.flatMap((a) => (a.type === "play" ? [a] : []));
  plays.sort((a, b) => rankIndex(a.card) - rankIndex(b.card) || SUITS.indexOf(suitOf(a.card)) - SUITS.indexOf(suitOf(b.card)));
  return plays[0] ?? null;
}
