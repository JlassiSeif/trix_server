// Trix for the bots (docs/bots.md §4, trix): a fast simulator of the stacks, and the easy and
// medium ways of choosing a card. Medium is also everyone's behaviour inside hard's simulations.

import { A, J, bit, maskOf, pickRandom, rankOf, suitOf, type Rng } from "./cards";

/** Stacks as rank ranges per suit; -1 while a suit hasn't started. */
export interface Stacks {
  low: number[];
  high: number[];
}

export function fits(st: Stacks, c: number): boolean {
  const s = suitOf(c);
  const r = rankOf(c);
  if (st.low[s]! < 0) return r === J;
  return r === st.high[s]! + 1 || r === st.low[s]! - 1;
}

export function place(st: Stacks, c: number): void {
  const s = suitOf(c);
  const r = rankOf(c);
  if (st.low[s]! < 0) {
    st.low[s] = r;
    st.high[s] = r;
  } else {
    st.low[s] = Math.min(st.low[s]!, r);
    st.high[s] = Math.max(st.high[s]!, r);
  }
}

/** The cards a placed card opens up next: Q and 9 after a jack, else the next rank outwards. */
function opens(st: Stacks, c: number): number[] {
  const s = suitOf(c);
  const r = rankOf(c);
  if (r === J && st.low[s]! < 0) return [s * 8 + J + 1, s * 8 + J - 1];
  if (st.low[s]! >= 0 && r === st.high[s]! + 1) return r < 7 ? [c + 1] : [];
  return r > 0 ? [c - 1] : [];
}

export function easyTrixCard(legal: readonly number[], rng: Rng): number {
  if (rng() >= 0.25) {
    const aces = legal.filter((c) => rankOf(c) === A);
    if (aces.length) return pickRandom(aces, rng);
  }
  return pickRandom(legal, rng);
}

/**
 * Medium (§4, trix): cards that open my own next cards, not other players' ones; aces for the
 * extra turn; the jack of the suit I hold most of.
 */
export function mediumTrixCard(st: Stacks, hand: readonly number[], legal: readonly number[]): number {
  const mine = maskOf(hand);
  let best = legal[0]!;
  let bestScore = -Infinity;
  for (const c of legal) {
    let score = rankOf(c) === A ? 3 : 0;
    for (let n of opens(st, c)) {
      // Follow the run while I hold it: every card I can then play myself is worth something.
      let run = 0;
      const step = n > c ? 1 : -1;
      while (mine & bit(n)) {
        run++;
        if ((step > 0 && rankOf(n) === 7) || (step < 0 && rankOf(n) === 0)) break;
        n += step;
      }
      if (run > 0) score += 2 + 0.5 * (run - 1);
      else score -= 1; // opens a card someone else is waiting for
    }
    if (rankOf(c) === J) {
      let same = 0;
      for (const h of hand) if (suitOf(h) === suitOf(c)) same++;
      score += 0.5 * same;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The simulator

export interface TrixSim {
  stacks: Stacks;
  hands: number[][];
  turn: number;
  finishers: number[];
  /** True once two players are out (R-TRIX-6), or if nobody could move (never with a real deal). */
  over: boolean;
}

function legalFor(sim: TrixSim, seat: number): number[] {
  return sim.hands[seat]!.filter((c) => fits(sim.stacks, c));
}

/** The first seat from `from` that can play; seats without a legal card pass (R-TRIX-4). */
function advance(sim: TrixSim, from: number): void {
  for (let i = 0; i < 4; i++) {
    const seat = (from + i) % 4;
    if (sim.hands[seat]!.length > 0 && legalFor(sim, seat).length > 0) {
      sim.turn = seat;
      return;
    }
  }
  sim.over = true;
}

export function trixSimPlay(sim: TrixSim, c: number): void {
  const seat = sim.turn;
  const hand = sim.hands[seat]!;
  hand.splice(hand.indexOf(c), 1);
  place(sim.stacks, c);
  if (hand.length === 0) {
    sim.finishers.push(seat);
    if (sim.finishers.length === 2) {
      sim.over = true;
      return;
    }
    advance(sim, (seat + 1) % 4);
  } else if (rankOf(c) === A) {
    advance(sim, seat); // R-TRIX-5: an ace gives an extra turn
  } else {
    advance(sim, (seat + 1) % 4);
  }
}

export function trixRollout(sim: TrixSim): void {
  let guard = 64;
  while (!sim.over && guard-- > 0) {
    const seat = sim.turn;
    trixSimPlay(sim, mediumTrixCard(sim.stacks, sim.hands[seat]!, legalFor(sim, seat)));
  }
}

/** R-TRIX-6: first out −100, second −50. */
export function trixSimScores(sim: TrixSim): number[] {
  return [0, 1, 2, 3].map((s) => (sim.finishers[0] === s ? -100 : sim.finishers[1] === s ? -50 : 0));
}
