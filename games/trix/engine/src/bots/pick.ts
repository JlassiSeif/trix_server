// Choosing a contract (docs/bots.md §3). Easy picks at random; medium reads its hand; hard reads
// its hand and plans: it compares this hand with an average hand for every contract, because
// every contract gets picked some time.

import { CONTRACTS, type Contract } from "../scoring";
import { A, C, D, H, J, K, KH, Q, R9, S, TEN, pickRandom, rankOf, seededRng, suitOf, type Rng } from "./cards";

/** Chance a card wins a trick, by rank (7 … A); long suits force high cards to win more often. */
const P_WIN = [0.02, 0.03, 0.05, 0.12, 0.22, 0.38, 0.6, 0.85];

/**
 * Points this hand is likely to take in each contract, before the picker's multiplier (§3's
 * table). Trix is negative: −100 for going out first, −50 for second.
 */
export function estimate(hand: readonly number[]): Record<Contract, number> {
  const bySuit = [0, 0, 0, 0].map((_, s) => hand.filter((c) => suitOf(c) === s));
  const len = (s: number) => bySuit[s]!.length;
  const has = (c: number) => hand.includes(c);
  const pWin = (c: number) => {
    const s = suitOf(c);
    const lower = bySuit[s]!.some((x) => rankOf(x) < rankOf(c));
    let p = P_WIN[rankOf(c)]! * (1 + 0.08 * Math.max(0, len(s) - 3));
    if (!lower && rankOf(c) >= K) p *= 1.15; // nothing to duck with in that suit
    return Math.min(0.95, p);
  };
  const tricks = hand.reduce((a, c) => a + pWin(c), 0);
  const voids = [H, C, D, S].filter((s) => len(s) === 0).length;
  const shortSuits = [C, D, S].filter((s) => len(s) <= 1).length;

  const pli = 10 * tricks;

  let dineri = 0;
  for (const c of hand) dineri += suitOf(c) === D ? pWin(c) * 25 : pWin(c) * 8;
  if (len(D) >= 4) dineri += 10;
  dineri -= 4 * voids;

  let damet = 0;
  for (const c of hand) {
    const s = suitOf(c);
    if (rankOf(c) === Q) damet += 20 * (bySuit[s]!.some((x) => rankOf(x) < Q) ? 0.3 : 0.55);
    else if (rankOf(c) >= K && !has(s * 8 + Q)) damet += 20 * pWin(c) * 0.5;
    else damet += 20 * pWin(c) * 0.1;
  }

  const low = hand.filter((c) => rankOf(c) <= R9).length;
  const longest = Math.max(len(H), len(C), len(D), len(S));
  const aces = hand.filter((c) => rankOf(c) === A).length;
  const farcha = 100 * Math.min(0.8, Math.max(0.05, 0.45 - 0.09 * low + 0.1 * Math.max(0, longest - 3) + 0.05 * aces));

  let rayP: number;
  if (has(KH)) {
    rayP = len(H) <= 1 ? 0.35 : len(H) === 2 ? 0.45 : 0.6;
    if (has(H * 8 + A) || has(H * 8 + TEN)) rayP += 0.1;
    if (shortSuits > 0) rayP -= 0.1;
  } else {
    rayP = 0.05 + (has(H * 8 + A) ? 0.12 : 0) + (has(H * 8 + TEN) ? 0.1 : 0);
    if (len(H) >= 3) rayP *= 1.3;
    rayP += 0.02 * tricks;
  }
  const ray = 100 * Math.max(0.02, rayP);

  const general = 0.9 * (pli + dineri + damet + farcha + ray);

  // Trix: jacks start stacks, aces give extra turns, cards next to my jacks run on; 7s and aces
  // in suits I have no jack of wait for everyone else. The picker places the first card.
  let g = 0.8;
  for (let s = 0; s < 4; s++) {
    const mine = bySuit[s]!;
    const jack = mine.some((c) => rankOf(c) === J);
    if (jack) {
      g += 1.2;
      for (let r = J + 1; r <= A && mine.some((c) => rankOf(c) === r); r++) g += 0.5;
      for (let r = J - 1; r >= 0 && mine.some((c) => rankOf(c) === r); r--) g += 0.5;
    }
    for (const c of mine) {
      if (rankOf(c) === A) g += jack ? 0.8 : 0.3;
      if (!jack && (rankOf(c) === 0 || rankOf(c) === A)) g -= 0.4;
    }
  }
  const first = Math.min(0.7, Math.max(0.02, 0.1 + 0.07 * g));
  const trix = -(100 * first + 50 * Math.min(0.35, 1 - first));

  return { dineri, damet, pli, farcha, ray, general, trix };
}

/** The same estimates averaged over random hands: what "an average hand" gets (hard, §3).
 *  Computed on first use (a few ms), so loading the engine costs nothing. */
let cachedBaseline: Record<Contract, number> | null = null;
export function baseline(): Record<Contract, number> {
  cachedBaseline ??= computeBaseline();
  return cachedBaseline;
}
function computeBaseline(): Record<Contract, number> {
  const rng = seededRng(20260924);
  const sum = Object.fromEntries(CONTRACTS.map((c) => [c, 0])) as Record<Contract, number>;
  const n = 3000;
  for (let i = 0; i < n; i++) {
    const deck = Array.from({ length: 32 }, (_, c) => c);
    for (let k = 31; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [deck[k], deck[j]] = [deck[j]!, deck[k]!];
    }
    const e = estimate(deck.slice(0, 8));
    for (const c of CONTRACTS) sum[c] += e[c];
  }
  for (const c of CONTRACTS) sum[c] /= n;
  return sum;
}

export interface PickSituation {
  hand: readonly number[];
  legal: readonly Contract[];
  /** Contracts this player has already picked. */
  used: readonly Contract[];
  total: number;
}

export function easyPick(p: PickSituation, rng: Rng): Contract {
  return pickRandom(p.legal, rng);
}

/** Above this (×2 already applied), medium calls it a bad hand and uses trix to escape it. */
const BAD_HAND = 70;

export function mediumPick(p: PickSituation): Contract {
  if (p.legal.length === 1) return p.legal[0]!;
  const e = estimate(p.hand);
  const lastPick = p.used.length === 6;
  const trickOnes = p.legal.filter((c) => c !== "trix");
  let best = trickOnes[0]!;
  for (const c of trickOnes) if (e[c] < e[best]) best = c;
  const cost = e[best] * (lastPick ? 4 : 2);
  // Trix is the escape from a bad hand, before the deadline forces it (R-GAME-11).
  if (p.legal.includes("trix") && cost > BAD_HAND) return "trix";
  // General must not become the ×4 last pick: from the 5th pick on it goes first, unless terrible.
  if (p.used.length >= 4 && p.legal.includes("general") && e.general <= baseline().general * 1.2) return "general";
  return best;
}

export function hardPick(p: PickSituation): Contract {
  if (p.legal.length === 1) return p.legal[0]!;
  const e = estimate(p.hand);
  const remainingTrick = CONTRACTS.filter((c) => c !== "trix" && !p.used.includes(c)).length;
  let best = p.legal[0]!;
  let bestValue = Infinity;
  for (const c of p.legal) {
    const now = c === "trix" ? 1 : p.used.length === 6 ? 4 : 2;
    // If not picked now, c is picked later with an average hand. A trick contract may end up as
    // the ×4 last pick (trix never can, R-GAME-11).
    const othersLeft = remainingTrick - (c === "trix" ? 0 : 1);
    const later = c === "trix" ? 1 : 2 + 2 / Math.max(1, othersLeft);
    let value = now * e[c] - later * baseline()[c];
    // Near 1000, a big score now could end the game with me last (§7): prefer safe contracts.
    const after = p.total + now * e[c];
    if (after > 850) value += (after - 850) * 0.5;
    if (value < bestValue) {
      bestValue = value;
      best = c;
    }
  }
  return best;
}
