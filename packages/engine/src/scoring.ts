// Contract scoring (RULES.md §5 and §6). Pure functions over what each seat took.

import { suitOf, rankOf, type CardId, type Seat, SEATS } from "./cards";

/** R-GAME-1. The order is also the placeholder bot's preference (R-BOT-2). */
export const CONTRACTS = ["dineri", "damet", "pli", "farcha", "ray", "general", "trix"] as const;
export type Contract = (typeof CONTRACTS)[number];
export type TrickContract = Exclude<Contract, "trix">;

export const KING_OF_HEARTS: CardId = "k_h";

/** What happened in a trick contract, as scoring needs it. */
export interface TrickOutcome {
  /** Won pile per seat (R-TRICK-5). */
  won: CardId[][];
  /** Tricks won per seat. */
  tricksWon: number[];
  /** Winner of the 8th trick, or null if the contract ended early. */
  lastTrickWinner: Seat | null;
  /** Who declared K♥ (R-RAY-3), if anyone. */
  kingDeclaredBy: Seat | null;
}

const count = (pile: CardId[], pred: (c: CardId) => boolean) => pile.filter(pred).length;

function dineri(o: TrickOutcome, s: Seat): number {
  const diamonds = count(o.won[s]!, (c) => suitOf(c) === "d");
  return diamonds === 8 ? 150 : diamonds * 10; // R-DIN-1, R-DIN-2
}

function damet(o: TrickOutcome, s: Seat): number {
  return count(o.won[s]!, (c) => rankOf(c) === "q") * 20; // R-DAM-1
}

function pli(o: TrickOutcome, s: Seat): number {
  const tricks = o.tricksWon[s]!;
  return tricks === 8 ? 150 : tricks * 10; // R-PLI-1, R-PLI-2
}

function farcha(o: TrickOutcome, s: Seat): number {
  return o.lastTrickWinner === s ? 100 : 0; // R-FAR-1
}

function ray(o: TrickOutcome, s: Seat): number {
  if (!o.won[s]!.includes(KING_OF_HEARTS)) return 0;
  return o.kingDeclaredBy === null ? 100 : 200; // R-RAY-1, R-RAY-4
}

/** Points each seat took in a trick contract, before multipliers and the declarer's −50. */
export function rawTrickScores(contract: TrickContract, o: TrickOutcome): number[] {
  return SEATS.map((s) => {
    switch (contract) {
      case "dineri":
        return dineri(o, s);
      case "damet":
        return damet(o, s);
      case "pli":
        return pli(o, s);
      case "farcha":
        return farcha(o, s);
      case "ray":
        return ray(o, s);
      case "general":
        // R-GEN-3: winning all 8 tricks collects every point and scores 0.
        if (o.tricksWon[s] === 8) return 0;
        // R-GEN-1: all five contracts at once, including their special rules.
        return dineri(o, s) + damet(o, s) + pli(o, s) + farcha(o, s) + ray(o, s);
    }
  });
}

/** Who took K♥, if it has been taken. */
export function kingTakenBy(won: CardId[][]): Seat | null {
  const seat = SEATS.find((s) => won[s]!.includes(KING_OF_HEARTS));
  return seat ?? null;
}

/**
 * Final contract scores: the picker's points × multiplier (R-MULT-1, R-MULT-2), then the
 * declarer's −50, which is never multiplied (R-RAY-6, R-MULT-4).
 */
export function applyMultipliers(args: {
  contract: TrickContract;
  raw: number[];
  picker: Seat;
  multiplier: number;
  kingDeclaredBy: Seat | null;
  kingTakenBy: Seat | null;
}): number[] {
  const scores = args.raw.map((points, s) => (s === args.picker ? points * args.multiplier : points));
  const { kingDeclaredBy: declarer, kingTakenBy: taker } = args;
  if ((args.contract === "ray" || args.contract === "general") && declarer !== null && taker !== null && taker !== declarer) {
    scores[declarer] = scores[declarer]! - 50;
  }
  return scores;
}

/** R-TRIX-6: first to finish −100, second −50, the others 0. No multipliers (R-TRIX-7). */
export function trixScores(finishers: Seat[]): number[] {
  return SEATS.map((s) => (finishers[0] === s ? -100 : finishers[1] === s ? -50 : 0));
}
