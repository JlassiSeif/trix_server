// Cards, ranking and the seeded shuffle (RULES.md §1).

export const SUITS = ["h", "c", "d", "s"] as const;
export type Suit = (typeof SUITS)[number];

/** R-DECK-2: lowest to highest. The same order is used for tricks and for trix stacks. */
export const RANKS = ["7", "8", "9", "j", "q", "k", "10", "a"] as const;
export type Rank = (typeof RANKS)[number];

/** Card ids match the old code and the card image names, e.g. "10_h", "k_d". */
export type CardId = `${Rank}_${Suit}`;

export type Seat = 0 | 1 | 2 | 3;
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

/** R-SEAT-1: all turn order goes counter-clockwise. Seat n+1 is the next seat counter-clockwise. */
export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

export function card(rank: Rank, suit: Suit): CardId {
  return `${rank}_${suit}`;
}

export function suitOf(id: CardId): Suit {
  return id.slice(id.indexOf("_") + 1) as Suit;
}

export function rankOf(id: CardId): Rank {
  return id.slice(0, id.indexOf("_")) as Rank;
}

/** Position in R-DECK-2 order: 0 for a 7, 7 for an ace. */
export function rankIndex(id: CardId): number {
  return RANKS.indexOf(rankOf(id));
}

/** R-DECK-1: 32 cards, 7 to A in each suit. */
export const DECK: readonly CardId[] = SUITS.flatMap((s) => RANKS.map((r) => card(r, s)));

const DECK_SET = new Set<string>(DECK);
export function isCardId(value: unknown): value is CardId {
  return typeof value === "string" && DECK_SET.has(value);
}

/** Display order for a hand: by suit (h, c, d, s), then highest first. */
export function sortHand(hand: readonly CardId[]): CardId[] {
  return [...hand].sort((a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || rankIndex(b) - rankIndex(a));
}

/**
 * mulberry32: a small seeded PRNG. The state is a single uint32, so it fits in the game
 * state and a whole game can be replayed from its seed.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** Fisher-Yates shuffle driven by the seeded PRNG. Returns the shuffled copy and the new PRNG state. */
export function shuffle<T>(items: readonly T[], rng: number): [T[], number] {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(state);
    state = next;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return [out, state];
}
