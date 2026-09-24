// Cards as numbers for the bots: suit * 8 + rank, in R-DECK-2 order (7 8 9 J Q K 10 A) and
// SUITS order (h c d s). Sets of cards are 32-bit masks, so "which higher cards are still out"
// is one AND and a bit count. Thinking ahead (hard, docs/bots.md §4) runs thousands of
// simulated tricks per move, so this matters.

import { DECK, nextRandom, type CardId } from "../cards";

export const H = 0;
export const C = 1;
export const D = 2;
export const S = 3;
export const R7 = 0;
export const R9 = 2;
export const J = 3;
export const Q = 4;
export const K = 5;
export const TEN = 6;
export const A = 7;
/** K♥ */
export const KH = H * 8 + K;

export const suitOf = (c: number) => c >> 3;
export const rankOf = (c: number) => c & 7;
export const bit = (c: number) => 1 << c;

/** DECK is built suit by suit, rank by rank, so a card's number is its position in DECK. */
const INDEX = new Map<string, number>(DECK.map((id, i) => [id, i]));
export const toNum = (id: CardId): number => INDEX.get(id)!;
export const toId = (c: number): CardId => DECK[c]!;

/** All cards of a suit. */
export const SUIT_MASK = [0, 1, 2, 3].map((s) => 0xff << (s * 8));
/** Same suit, higher / lower rank than the card. */
export const HIGHER = Array.from({ length: 32 }, (_, c) => {
  let m = 0;
  for (let r = rankOf(c) + 1; r < 8; r++) m |= bit(suitOf(c) * 8 + r);
  return m;
});
export const LOWER = Array.from({ length: 32 }, (_, c) => {
  let m = 0;
  for (let r = 0; r < rankOf(c); r++) m |= bit(suitOf(c) * 8 + r);
  return m;
});
export const ALL = ~0;

export function popcount(m: number): number {
  m = m - ((m >>> 1) & 0x55555555);
  m = (m & 0x33333333) + ((m >>> 2) & 0x33333333);
  return (((m + (m >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function maskOf(cards: readonly number[]): number {
  let m = 0;
  for (const c of cards) m |= bit(c);
  return m;
}

/** A random source in [0, 1). Bots get their own, so their choices never touch the deal. */
export type Rng = () => number;

/** mulberry32, the same generator the engine deals with, seeded separately. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    const [v, next] = nextRandom(state);
    state = next;
    return v;
  };
}

export const pickRandom = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]!;

/** Highest / lowest rank among the cards (first on ties). */
export function highest(cards: readonly number[]): number {
  let best = cards[0]!;
  for (const c of cards) if (rankOf(c) > rankOf(best)) best = c;
  return best;
}
export function lowest(cards: readonly number[]): number {
  let best = cards[0]!;
  for (const c of cards) if (rankOf(c) < rankOf(best)) best = c;
  return best;
}
