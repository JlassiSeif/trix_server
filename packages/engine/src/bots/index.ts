// The bots (docs/bots.md, approved 2026-09-24): easy, medium and hard.
//
// A bot decides from exactly what a player in its seat has: its view, and the public events of
// the current contract (§1). It is never given the game state, so it cannot see other hands.

import type { Action, GameEvent } from "../game";
import type { TrickContract } from "../scoring";
import type { PlayerView } from "../view";
import { maskOf, toId, toNum, type Rng } from "./cards";
import { hardDeclares, hardTrickCard, hardTrixCard, type ThinkOptions } from "./hard";
import { remember, wonSoFar } from "./memory";
import { easyPick, hardPick, mediumPick } from "./pick";
import { easyTrickCard, legalCards, mediumDeclares, mediumTrickCard, type TrickSituation } from "./tricks";
import { easyTrixCard, fits, mediumTrixCard, type Stacks } from "./trix";

export { seededRng, type Rng } from "./cards";
export type { ThinkOptions } from "./hard";

export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];
export const isBotLevel = (v: unknown): v is BotLevel => BOT_LEVELS.includes(v as BotLevel);

/**
 * The bot's move for the seat whose view this is, or null if it has nothing to do.
 * `events`: the public events since the current contract was dealt (a player's memory).
 */
export function botAction(level: BotLevel, view: PlayerView, events: readonly GameEvent[], rng: Rng, opts: ThinkOptions = {}): Action | null {
  const legal = view.legal;
  if (!legal.length) return null;
  const choice = decide(level, view, events, rng, opts);
  // Whatever happens above, only ever answer with a move the engine offered.
  if (choice && legal.some((a) => JSON.stringify(a) === JSON.stringify(choice))) return choice;
  return legal.find((a) => a.type === "pick" || a.type === "play") ?? null;
}

function decide(level: BotLevel, view: PlayerView, events: readonly GameEvent[], rng: Rng, opts: ThinkOptions): Action | null {
  const legal = view.legal;
  const hand = view.hand.map(toNum);

  // Picking a contract (§3).
  const picks = legal.flatMap((a) => (a.type === "pick" ? [a.contract] : []));
  if (picks.length) {
    const p = { hand, legal: picks, used: view.used[view.seat] ?? [], total: view.totals[view.seat] ?? 0 };
    const contract = level === "easy" ? easyPick(p, rng) : level === "medium" ? mediumPick(p) : hardPick(p);
    return { type: "pick", contract };
  }

  const mem = remember(events, view.contract);

  // Trix (§4).
  if (view.phase === "trix") {
    const stacks: Stacks = { low: [-1, -1, -1, -1], high: [-1, -1, -1, -1] };
    (["h", "c", "d", "s"] as const).forEach((s, i) => {
      const st = view.stacks[s];
      if (st) {
        stacks.low[i] = st.low;
        stacks.high[i] = st.high;
      }
    });
    // The stacks show exactly which cards are on the table.
    let onTable = 0;
    for (let s = 0; s < 4; s++) for (let r = stacks.low[s]!; r >= 0 && r <= stacks.high[s]!; r++) onTable |= 1 << (s * 8 + r);
    mem.played = onTable;
    const plays = hand.filter((c) => fits(stacks, c));
    if (!plays.length) return null;
    let card: number | null;
    if (level === "easy") card = easyTrixCard(plays, rng);
    else if (level === "medium") card = mediumTrixCard(stacks, hand, plays);
    else
      card =
        hardTrixCard({ me: view.seat, hand, stacks, handCounts: view.handCounts, finishers: view.finishers, totals: view.totals, mem }, rng, opts) ??
        mediumTrixCard(stacks, hand, plays);
    return { type: "play", card: toId(card) };
  }

  if (view.phase !== "tricks" || !view.contract || view.contract === "trix") return null;
  const contract = view.contract as TrickContract;
  const trick = view.trick.map((p) => ({ seat: p.seat, card: toNum(p.card) }));
  // The current trick's cards are in the memory already; the view is the authority on it.
  mem.played |= maskOf(trick.map((p) => p.card));
  mem.kingDeclaredBy = view.kingDeclaredBy ?? -1;
  const situation: TrickSituation = {
    contract,
    seat: view.seat,
    hand,
    trick,
    played: mem.played,
    tricksPlayed: view.tricksWon.reduce((a, b) => a + b, 0),
    tricksWon: view.tricksWon,
    kingDeclaredBy: mem.kingDeclaredBy,
  };
  const knowledge = {
    me: view.seat,
    contract,
    picker: view.picker,
    multiplier: view.multiplier,
    hand,
    trick,
    handCounts: view.handCounts,
    tricksWon: view.tricksWon,
    totals: view.totals,
    mem,
    won: wonSoFar(mem),
  };

  // Declaring K♥ (§5): easy never does.
  if (legal.some((a) => a.type === "declareKing")) {
    const declare = level === "medium" ? mediumDeclares(hand) : level === "hard" ? (hardDeclares(knowledge, rng, opts) ?? mediumDeclares(hand)) : false;
    if (declare) return { type: "declareKing" };
  }

  if (!legalCards(hand, trick).length) return null;
  let card: number;
  if (level === "easy") {
    // Easy has no memory beyond the current trick.
    card = easyTrickCard({ ...situation, played: maskOf(trick.map((p) => p.card)) }, rng);
  } else if (level === "medium") card = mediumTrickCard(situation);
  else card = hardTrickCard(knowledge, rng, opts) ?? mediumTrickCard(situation);
  return { type: "play", card: toId(card) };
}
