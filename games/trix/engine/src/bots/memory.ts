// What a player at the table can know from public events this contract (docs/bots.md §1):
// every card played, every completed trick and its winner, who showed out of which suit,
// who declared K♥, and, in trix, which cards a player who passed cannot be holding.
// Nothing here comes from the game state: only from events every player saw.

import type { GameEvent } from "../game";
import type { Contract } from "../scoring";
import { J, KH, bit, suitOf, rankOf, toNum } from "./cards";

export interface Trick {
  cards: { seat: number; card: number }[];
  winner: number;
}

export interface Memory {
  /** Cards played this contract (tricks, or placed on the trix stacks). */
  played: number;
  /** Completed tricks, in order. */
  tricks: Trick[];
  /** Per seat: cards that seat cannot be holding (showed out of a suit, or passed in trix). */
  cannotHold: number[];
  kingDeclaredBy: number;
}

/** Trix stacks while replaying events: lowest and highest rank per suit, -1 if not started. */
function fitting(low: number[], high: number[]): number {
  let m = 0;
  for (let s = 0; s < 4; s++) {
    if (low[s]! < 0) m |= bit(s * 8 + J);
    else {
      if (high[s]! < 7) m |= bit(s * 8 + high[s]! + 1);
      if (low[s]! > 0) m |= bit(s * 8 + low[s]! - 1);
    }
  }
  return m;
}

/**
 * Replays the public events since the deal. `contract` is the current contract from the view,
 * for when the list starts after the pick (e.g. after a server restart lost part of the log).
 */
export function remember(events: readonly GameEvent[], contract: Contract | null): Memory {
  const mem: Memory = { played: 0, tricks: [], cannotHold: [0, 0, 0, 0], kingDeclaredBy: -1 };
  let trix = contract === "trix";
  let current: { seat: number; card: number }[] = [];
  const low = [-1, -1, -1, -1];
  const high = [-1, -1, -1, -1];
  for (const e of events) {
    switch (e.type) {
      case "dealt":
        return remember(events.slice(events.indexOf(e) + 1), contract);
      case "picked":
        trix = e.contract === "trix";
        break;
      case "kingDeclared":
        mem.kingDeclaredBy = e.seat;
        break;
      case "cardPlayed": {
        const c = toNum(e.card);
        mem.played |= bit(c);
        if (trix) {
          const s = suitOf(c);
          const r = rankOf(c);
          low[s] = low[s]! < 0 ? r : Math.min(low[s]!, r);
          high[s] = Math.max(high[s]!, r);
        } else {
          const led = current[0];
          if (led && suitOf(led.card) !== suitOf(c)) mem.cannotHold[e.seat] = mem.cannotHold[e.seat]! | (0xff << (suitOf(led.card) * 8));
          current.push({ seat: e.seat, card: c });
        }
        break;
      }
      case "trickWon":
        mem.tricks.push({ cards: e.cards.map((p) => ({ seat: p.seat, card: toNum(p.card) })), winner: e.seat });
        current = [];
        break;
      case "passed":
        // R-TRIX-4: a player passes only with no legal card, so they hold none of the cards that fit.
        mem.cannotHold[e.seat] = mem.cannotHold[e.seat]! | fitting(low, high);
        break;
    }
  }
  return mem;
}

/** Who has taken what so far (for scoring the rest of the contract). */
export function wonSoFar(mem: Memory): { diamonds: number[]; queens: number[]; kingTaker: number } {
  const diamonds = [0, 0, 0, 0];
  const queens = [0, 0, 0, 0];
  let kingTaker = -1;
  for (const t of mem.tricks) {
    for (const { card } of t.cards) {
      if (suitOf(card) === 2) diamonds[t.winner]!++;
      if (rankOf(card) === 4) queens[t.winner]!++;
      if (card === KH) kingTaker = t.winner;
    }
  }
  return { diamonds, queens, kingTaker };
}
