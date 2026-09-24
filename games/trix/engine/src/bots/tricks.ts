// Trick contracts for the bots (docs/bots.md §4, §5): a fast simulator, and the easy and
// medium ways of choosing a card. Medium's rules are also how every player behaves inside
// hard's simulations.

import type { TrickContract } from "../scoring";
import {
  A,
  D,
  H,
  HIGHER,
  K,
  KH,
  LOWER,
  Q,
  SUIT_MASK,
  TEN,
  bit,
  highest,
  lowest,
  maskOf,
  pickRandom,
  popcount,
  rankOf,
  suitOf,
  type Rng,
} from "./cards";

/** What one player sees when choosing a card, in numbers. `played` includes the current trick. */
export interface TrickSituation {
  contract: TrickContract;
  seat: number;
  hand: readonly number[];
  trick: readonly { seat: number; card: number }[];
  played: number;
  tricksPlayed: number;
  tricksWon: readonly number[];
  kingDeclaredBy: number;
}

export function legalCards(hand: readonly number[], trick: readonly { card: number }[]): number[] {
  if (trick.length === 0) return [...hand];
  const led = suitOf(trick[0]!.card);
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : [...hand];
}

// ---------------------------------------------------------------------------
// Points

/** Points a card carries in this contract (what the trick's winner takes with it). */
export function cardPoints(contract: TrickContract, c: number, declared: boolean): number {
  let p = 0;
  if ((contract === "dineri" || contract === "general") && suitOf(c) === D) p += 10;
  if ((contract === "damet" || contract === "general") && rankOf(c) === Q) p += 20;
  if ((contract === "ray" || contract === "general") && c === KH) p += declared ? 200 : 100;
  return p;
}

/** Points for winning a trick whatever is in it: a trick in pli, the last trick in farcha. */
function trickBase(contract: TrickContract, tricksPlayed: number): number {
  let p = 0;
  if (contract === "pli" || contract === "general") p += 10;
  if ((contract === "farcha" || contract === "general") && tricksPlayed === 7) p += 100;
  return p;
}

// ---------------------------------------------------------------------------
// Easy (§4): one trick at a time, no memory, and 1 move in 4 at random.

function easyDanger(contract: TrickContract, c: number): number {
  const general = contract === "general";
  if ((contract === "ray" || general) && c === KH) return 100;
  if ((contract === "damet" || general) && rankOf(c) === Q) return 50;
  if ((contract === "dineri" || general) && suitOf(c) === D) return 20 + rankOf(c);
  return rankOf(c);
}

export function easyTrickCard(t: TrickSituation, rng: Rng): number {
  const legal = legalCards(t.hand, t.trick);
  if (rng() < 0.25) return pickRandom(legal, rng);
  if (t.trick.length === 0) {
    const low = rankOf(lowest(legal));
    return pickRandom(
      legal.filter((c) => rankOf(c) === low),
      rng,
    );
  }
  const led = suitOf(t.trick[0]!.card);
  if (suitOf(legal[0]!) === led) {
    const win = Math.max(...t.trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
    const under = legal.filter((c) => rankOf(c) < win);
    return under.length ? highest(under) : highest(legal);
  }
  let best = legal[0]!;
  for (const c of legal) if (easyDanger(t.contract, c) > easyDanger(t.contract, best)) best = c;
  return best;
}

// ---------------------------------------------------------------------------
// Medium (§4): the easy rules without the random moves, plus what's still out.

/** How much a card hurts to keep: the one to throw away first when out of the led suit. */
function danger(t: TrickSituation, c: number, unseen: number, hand: number): number {
  const r = rankOf(c);
  const s = suitOf(c);
  const kingOut = (unseen & bit(KH)) !== 0;
  const queenOut = (unseen & bit(s * 8 + Q)) !== 0;
  const shortSuit = popcount(hand & SUIT_MASK[s]!) <= 2 ? 0.5 : 0;
  switch (t.contract) {
    case "dineri":
      return s === D ? 20 + r : r * 0.6 + shortSuit;
    case "damet":
      return r === Q ? 30 + r : r >= K && queenOut ? 10 + r : r * 0.6 + shortSuit;
    case "ray":
      return c === KH ? 100 : s === H && r >= TEN && kingOut ? 50 + r : r * 0.6 + shortSuit;
    case "pli":
    case "farcha":
      return r + shortSuit;
    case "general":
      if (c === KH) return 100;
      if (r === Q) return 40 + r;
      if (s === H && r >= TEN && kingOut) return 35 + r;
      if (s === D) return 20 + r;
      return r + shortSuit;
  }
}

/** What winning a trick led with `c` would likely cost (docs/bots.md §4, leading). */
function leadCost(t: TrickSituation, c: number, unseen: number): number {
  const s = suitOf(c);
  const declared = t.kingDeclaredBy >= 0;
  const kingOut = (unseen & bit(KH)) !== 0;
  const unseenD = popcount(unseen & SUIT_MASK[D]!);
  let cost = trickBase(t.contract, t.tricksPlayed) + cardPoints(t.contract, c, declared);
  const general = t.contract === "general";
  if (t.contract === "dineri" || general) cost += s === D ? 10 * Math.min(3, unseenD) * 0.7 : unseenD > 0 ? 6 : 0;
  if (t.contract === "damet" || general) {
    if (unseen & bit(s * 8 + Q)) cost += 16;
    cost += 3 * popcount(unseen & (bit(Q) | bit(8 + Q) | bit(16 + Q) | bit(24 + Q)));
  }
  if ((t.contract === "ray" || general) && kingOut) cost += (declared ? 200 : 100) * (s === H ? 0.6 : 0.1);
  return cost;
}

/** General only: won every trick so far and holds only top cards, so go for all 8 (R-GEN-3). */
function sweeping(t: TrickSituation, unseen: number): boolean {
  if (t.contract !== "general" || t.tricksPlayed < 5 || t.tricksWon[t.seat] !== t.tricksPlayed) return false;
  return t.hand.every((c) => (unseen & HIGHER[c]!) === 0);
}

export function mediumTrickCard(t: TrickSituation): number {
  const legal = legalCards(t.hand, t.trick);
  if (legal.length === 1) return legal[0]!;
  const hand = maskOf(t.hand);
  const unseen = ~(hand | t.played);
  const farchaEarly = t.contract === "farcha" && t.tricksPlayed < 7;

  // Leading.
  if (t.trick.length === 0) {
    if (sweeping(t, unseen)) return highest(legal);
    if (farchaEarly) {
      // Early tricks are free in farcha: spend high cards, from the shortest suit first.
      let best = legal[0]!;
      const len = (c: number) => popcount(hand & SUIT_MASK[suitOf(c)]!);
      for (const c of legal) if (rankOf(c) > rankOf(best) || (rankOf(c) === rankOf(best) && len(c) < len(best))) best = c;
      return best;
    }
    const declaredByOther = t.kingDeclaredBy >= 0 && t.kingDeclaredBy !== t.seat && (unseen & bit(KH)) !== 0;
    let best = legal[0]!;
    let bestScore = Infinity;
    for (const c of legal) {
      const inSuit = unseen & SUIT_MASK[suitOf(c)]!;
      const hi = popcount(unseen & HIGHER[c]!);
      const lo = popcount(unseen & LOWER[c]!);
      const pWin = inSuit === 0 || hi === 0 ? 1 : lo === 0 ? 0.05 : 0.2 + (0.6 * lo) / (lo + hi);
      let score = pWin * leadCost(t, c, unseen) - (1 - pWin) * cardPoints(t.contract, c, t.kingDeclaredBy >= 0) * 0.5 + rankOf(c) * 0.01;
      // Flush a declared K♥: lead a low heart and make its holder play it (§4, ray).
      if (declaredByOther && suitOf(c) === H && rankOf(c) < K) score -= 15;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  const led = suitOf(t.trick[0]!.card);
  // Out of the led suit: throw away the most dangerous card.
  if (suitOf(legal[0]!) !== led) {
    let best = legal[0]!;
    for (const c of legal) if (danger(t, c, unseen, hand) > danger(t, best, unseen, hand)) best = c;
    return best;
  }

  // Following suit.
  if (farchaEarly || sweeping(t, unseen)) return highest(legal);
  const win = Math.max(...t.trick.filter((p) => suitOf(p.card) === led).map((p) => rankOf(p.card)));
  const under = legal.filter((c) => rankOf(c) < win);
  const over = legal.filter((c) => rankOf(c) > win);
  const last = t.trick.length === 3;
  if (under.length) {
    // Last to play on a trick with nothing in it: win it with a dangerous high card to get rid of it.
    if (last && over.length && t.contract !== "pli" && t.contract !== "general") {
      const top = highest(over);
      const declared = t.kingDeclaredBy >= 0;
      const clean = t.trick.every((p) => cardPoints(t.contract, p.card, declared) === 0) && cardPoints(t.contract, top, declared) === 0;
      const lastTrick = t.contract === "farcha" && t.tricksPlayed === 7;
      if (clean && !lastTrick && rankOf(top) >= K) return top;
    }
    return highest(under);
  }
  if (last) return highest(legal);
  const low = lowest(legal);
  // Nobody still to play can beat even my lowest card: the trick is mine, so spend the highest.
  return (unseen & HIGHER[low]!) === 0 ? highest(legal) : low;
}

/** Medium declares K♥ with at most one other heart, no A♥ or 10♥, and a way out (§5). */
export function mediumDeclares(hand: readonly number[]): boolean {
  const m = maskOf(hand);
  if (!(m & bit(KH))) return false;
  if (popcount(m & SUIT_MASK[H]!) > 2) return false;
  if (m & (bit(H * 8 + A) | bit(H * 8 + TEN))) return false;
  return [1, 2, 3].some((s) => popcount(m & SUIT_MASK[s]!) <= 1);
}

// ---------------------------------------------------------------------------
// The simulator

export interface TrickSim {
  contract: TrickContract;
  picker: number;
  multiplier: number;
  kingDeclaredBy: number;
  hands: number[][];
  trick: { seat: number; card: number }[];
  played: number;
  turn: number;
  tricksPlayed: number;
  tricksWon: number[];
  diamonds: number[];
  queens: number[];
  kingTaker: number;
  lastWinner: number;
}

export function simPlay(sim: TrickSim, c: number): void {
  const seat = sim.turn;
  const hand = sim.hands[seat]!;
  hand.splice(hand.indexOf(c), 1);
  sim.played |= bit(c);
  sim.trick.push({ seat, card: c });
  if (sim.trick.length < 4) {
    sim.turn = (seat + 1) % 4;
    return;
  }
  const led = suitOf(sim.trick[0]!.card);
  let best = sim.trick[0]!;
  for (const p of sim.trick) if (suitOf(p.card) === led && rankOf(p.card) > rankOf(best.card)) best = p;
  const w = best.seat;
  for (const p of sim.trick) {
    if (suitOf(p.card) === D) sim.diamonds[w]!++;
    if (rankOf(p.card) === Q) sim.queens[w]!++;
    if (p.card === KH) sim.kingTaker = w;
  }
  sim.tricksWon[w]!++;
  sim.tricksPlayed++;
  sim.lastWinner = w;
  sim.trick = [];
  sim.turn = w;
}

/** 8 tricks, or an early ending (R-DIN-3, R-DAM-2, R-RAY-2). */
export function simOver(sim: TrickSim): boolean {
  if (sim.tricksPlayed === 8) return true;
  switch (sim.contract) {
    case "dineri":
      return sim.diamonds.reduce((a, b) => a + b, 0) === 8;
    case "damet":
      return sim.queens.reduce((a, b) => a + b, 0) === 4;
    case "ray":
      return sim.kingTaker >= 0;
    default:
      return false;
  }
}

/** Contract scores, as the engine computes them (RULES.md §5, §6). */
export function simScores(sim: TrickSim): number[] {
  const raw = [0, 1, 2, 3].map((s) => {
    const din = sim.diamonds[s] === 8 ? 150 : sim.diamonds[s]! * 10;
    const dam = sim.queens[s]! * 20;
    const pli = sim.tricksWon[s] === 8 ? 150 : sim.tricksWon[s]! * 10;
    const far = sim.tricksPlayed === 8 && sim.lastWinner === s ? 100 : 0;
    const ray = sim.kingTaker === s ? (sim.kingDeclaredBy < 0 ? 100 : 200) : 0;
    switch (sim.contract) {
      case "dineri":
        return din;
      case "damet":
        return dam;
      case "pli":
        return pli;
      case "farcha":
        return far;
      case "ray":
        return ray;
      case "general":
        return sim.tricksWon[s] === 8 ? 0 : din + dam + pli + far + ray;
    }
  });
  const scores = raw.map((p, s) => (s === sim.picker ? p * sim.multiplier : p));
  const d = sim.kingDeclaredBy;
  if ((sim.contract === "ray" || sim.contract === "general") && d >= 0 && sim.kingTaker >= 0 && sim.kingTaker !== d) scores[d]! -= 50;
  return scores;
}

/** Plays the contract to its end with everyone following medium's rules. */
export function rollout(sim: TrickSim): void {
  while (!simOver(sim)) {
    const seat = sim.turn;
    const c = mediumTrickCard({
      contract: sim.contract,
      seat,
      hand: sim.hands[seat]!,
      trick: sim.trick,
      played: sim.played,
      tricksPlayed: sim.tricksPlayed,
      tricksWon: sim.tricksWon,
      kingDeclaredBy: sim.kingDeclaredBy,
    });
    simPlay(sim, c);
  }
}
