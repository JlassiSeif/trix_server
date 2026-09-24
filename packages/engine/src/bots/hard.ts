// Hard (docs/bots.md §4, §5, §7): imagine deals of the hidden cards that fit everything this
// player knows, play each candidate move forward with medium's rules for everyone, and keep the
// move that costs least on average. "Cost" is scoreboard-aware (§7).

import type { TrickContract } from "../scoring";
import { KH, bit, type Rng } from "./cards";
import type { Memory } from "./memory";
import { legalCards, rollout, simPlay, simScores, type TrickSim } from "./tricks";
import { fits, trixRollout, trixSimPlay, trixSimScores, type Stacks, type TrixSim } from "./trix";

export interface ThinkOptions {
  /** Deals to imagine per move (default 40). */
  samples?: number;
  /** Stop thinking after this long, keeping what was learned (default 30 ms). */
  budgetMs?: number;
  now?: () => number;
}
const clock = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

/**
 * One imagined deal of the hidden cards: each other seat gets as many as it holds, never a card
 * it can't have (showed out of the suit, passed in trix), and a declared K♥ goes to its declarer.
 * The most constrained cards are placed first; a dead end retries, and after 30 tries the
 * constraints are dropped (only possible if the memory is incomplete).
 */
export function sampleHands(me: number, myHand: readonly number[], hidden: readonly number[], counts: readonly number[], cannot: readonly number[], kingWith: number, rng: Rng): number[][] {
  for (let attempt = 0; attempt < 31; attempt++) {
    const strict = attempt < 30;
    const hands: number[][] = [[], [], [], []];
    hands[me] = [...myHand];
    const cap = counts.map((n, s) => (s === me ? 0 : n));
    const cards = [...hidden];
    if (kingWith >= 0 && kingWith !== me && cards.includes(KH) && cap[kingWith]! > 0) {
      cards.splice(cards.indexOf(KH), 1);
      hands[kingWith]!.push(KH);
      cap[kingWith]!--;
    }
    const eligible = (c: number) => [0, 1, 2, 3].filter((s) => cap[s]! > 0 && (!strict || !(cannot[s]! & bit(c))));
    for (let k = cards.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [cards[k], cards[j]] = [cards[j]!, cards[k]!];
    }
    if (strict) cards.sort((a, b) => eligible(a).length - eligible(b).length);
    let ok = true;
    for (const c of cards) {
      const seats = eligible(c);
      if (!seats.length) {
        ok = false;
        break;
      }
      const total = seats.reduce((a, s) => a + cap[s]!, 0);
      let x = rng() * total;
      let seat = seats[seats.length - 1]!;
      for (const s of seats) {
        x -= cap[s]!;
        if (x < 0) {
          seat = s;
          break;
        }
      }
      hands[seat]!.push(c);
      cap[seat]!--;
    }
    if (ok) return hands;
  }
  return [];
}

/**
 * How much a contract's scores cost this player, scoreboard included (§7): going over 1000 loses
 * the game; landing on exactly 1000 resets to 0; handing someone else exactly 1000 is a gift;
 * someone else going over ends the game, which is good unless I would be last.
 */
export function cost(me: number, totals: readonly number[], scores: readonly number[]): number {
  let u = scores[me]!;
  const after = totals.map((t, s) => t + scores[s]!);
  if (after[me] === 1000) u -= 600;
  if (after[me]! > 1000) u += 1500;
  let busted = false;
  for (let s = 0; s < 4; s++) {
    if (s === me) continue;
    if (after[s] === 1000) u += 300;
    if (after[s]! > 1000) busted = true;
  }
  if (busted && after[me]! <= 1000) {
    const finals = after.map((t) => (t === 1000 ? 0 : t));
    u -= finals[me] === Math.min(...finals) ? 400 : 150;
  }
  return u;
}

/** Everything hard knows about a trick contract in progress. */
export interface TrickKnowledge {
  me: number;
  contract: TrickContract;
  picker: number;
  multiplier: number;
  hand: number[];
  trick: { seat: number; card: number }[];
  handCounts: number[];
  tricksWon: number[];
  totals: number[];
  mem: Memory;
  won: { diamonds: number[]; queens: number[]; kingTaker: number };
}

function hiddenCards(k: { hand: readonly number[]; mem: Memory; handCounts: readonly number[]; me: number }, rng: Rng): number[] | null {
  let taken = k.mem.played;
  for (const c of k.hand) taken |= bit(c);
  const hidden: number[] = [];
  for (let c = 0; c < 32; c++) if (!(taken & bit(c))) hidden.push(c);
  const need = k.handCounts.reduce((a, n, s) => (s === k.me ? a : a + n), 0);
  // An incomplete memory (e.g. after a server restart) leaves extra "hidden" cards: drop some at random.
  while (hidden.length > need) hidden.splice(Math.floor(rng() * hidden.length), 1);
  return hidden.length === need ? hidden : null;
}

/**
 * Average cost of each candidate card over imagined deals. With `declare`, the K♥ is declared
 * by me first. Returns null if no deal could be imagined.
 */
export function thinkTricks(k: TrickKnowledge, candidates: readonly number[], rng: Rng, opts: ThinkOptions, declare = false): number[] | null {
  const hidden = hiddenCards(k, rng);
  if (!hidden) return null;
  const samples = opts.samples ?? 40;
  const budget = opts.budgetMs ?? 30;
  const now = opts.now ?? clock;
  const start = now();
  const sums = candidates.map(() => 0);
  let n = 0;
  const declaredBy = declare ? k.me : k.mem.kingDeclaredBy;
  for (let i = 0; i < samples; i++) {
    const hands = sampleHands(k.me, k.hand, hidden, k.handCounts, k.mem.cannotHold, declaredBy, rng);
    if (!hands.length) continue;
    candidates.forEach((card, ci) => {
      const sim: TrickSim = {
        contract: k.contract,
        picker: k.picker,
        multiplier: k.multiplier,
        kingDeclaredBy: declaredBy,
        hands: hands.map((h) => [...h]),
        trick: [...k.trick],
        played: k.mem.played,
        turn: k.me,
        tricksPlayed: k.tricksWon.reduce((a, b) => a + b, 0),
        tricksWon: [...k.tricksWon],
        diamonds: [...k.won.diamonds],
        queens: [...k.won.queens],
        kingTaker: k.won.kingTaker,
        lastWinner: -1,
      };
      simPlay(sim, card);
      rollout(sim);
      sums[ci]! += cost(k.me, k.totals, simScores(sim));
    });
    n++;
    if (now() - start > budget) break;
  }
  return n ? sums.map((s) => s / n) : null;
}

export function hardTrickCard(k: TrickKnowledge, rng: Rng, opts: ThinkOptions): number | null {
  const legal = legalCards(k.hand, k.trick);
  if (legal.length === 1) return legal[0]!;
  const avg = thinkTricks(k, legal, rng, opts);
  if (!avg) return null;
  let best = 0;
  for (let i = 1; i < legal.length; i++) if (avg[i]! < avg[best]!) best = i;
  return legal[best]!;
}

/** Declare K♥ if the best line with the declaration costs less than the best line without (§5). */
export function hardDeclares(k: TrickKnowledge, rng: Rng, opts: ThinkOptions): boolean | null {
  const legal = legalCards(k.hand, k.trick);
  const half = { ...opts, budgetMs: (opts.budgetMs ?? 30) / 2 };
  const without = thinkTricks(k, legal, rng, half, false);
  const withIt = thinkTricks(k, legal, rng, half, true);
  if (!without || !withIt) return null;
  return Math.min(...withIt) < Math.min(...without);
}

/** Everything hard knows in trix. */
export interface TrixKnowledge {
  me: number;
  hand: number[];
  stacks: Stacks;
  handCounts: number[];
  finishers: number[];
  totals: number[];
  mem: Memory;
}

export function hardTrixCard(k: TrixKnowledge, rng: Rng, opts: ThinkOptions): number | null {
  const legal = k.hand.filter((c) => fits(k.stacks, c));
  if (legal.length <= 1) return legal[0] ?? null;
  const hidden = hiddenCards(k, rng);
  if (!hidden) return null;
  const samples = opts.samples ?? 40;
  const budget = opts.budgetMs ?? 30;
  const now = opts.now ?? clock;
  const start = now();
  const sums = legal.map(() => 0);
  let n = 0;
  for (let i = 0; i < samples; i++) {
    const hands = sampleHands(k.me, k.hand, hidden, k.handCounts, k.mem.cannotHold, -1, rng);
    if (!hands.length) continue;
    legal.forEach((card, ci) => {
      const sim: TrixSim = {
        stacks: { low: [...k.stacks.low], high: [...k.stacks.high] },
        hands: hands.map((h) => [...h]),
        turn: k.me,
        finishers: [...k.finishers],
        over: false,
      };
      trixSimPlay(sim, card);
      trixRollout(sim);
      sums[ci]! += cost(k.me, k.totals, trixSimScores(sim));
    });
    n++;
    if (now() - start > budget) break;
  }
  if (!n) return null;
  let best = 0;
  for (let i = 1; i < legal.length; i++) if (sums[i]! < sums[best]!) best = i;
  return legal[best]!;
}
