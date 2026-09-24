// Everything the table says in words. English for now (R-TABLE-9).

import type { CardId, Contract, GameEvent, Seat } from "@games/trix";

export const CONTRACT_ORDER: Contract[] = ["dineri", "damet", "pli", "farcha", "ray", "general", "trix"];

/** One line per contract, from RULES.md §6. */
export const CONTRACT_RULE: Record<Contract, string> = {
  dineri: "+10 per ♦ taken · all 8 ♦ = 150",
  damet: "+20 per queen taken",
  pli: "+10 per trick · all 8 tricks = 150",
  farcha: "+100 for the last trick",
  ray: "+100 for taking K♥ · 200 if declared",
  general: "All five at once · all 8 tricks = 0",
  trix: "Build from the jacks · 1st out −100, 2nd −50",
};

const SUIT_SYMBOL: Record<string, string> = { h: "♥", c: "♣", d: "♦", s: "♠" };
export function cardLabel(id: CardId): string {
  const [rank, suit] = id.split("_") as [string, string];
  return `${rank.toUpperCase()}${SUIT_SYMBOL[suit]}`;
}

export const multiplierLabel = (contract: Contract, multiplier: number, forced: boolean) =>
  contract === "trix" ? "no multiplier" : `×${multiplier}${forced ? " (last pick)" : ""}`;

export const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/** A sentence for the activity feed, or null for events too small to mention. */
export function describe(e: GameEvent, name: (s: Seat) => string, you: Seat): string | null {
  const who = (s: Seat) => (s === you ? "You" : name(s));
  switch (e.type) {
    case "dealt":
      return `Contract ${e.contractNo}: new deal. ${who(e.picker)} ${e.picker === you ? "pick" : "picks"} the contract.`;
    case "picked":
      return `${who(e.seat)} chose ${e.contract.toUpperCase()}${e.contract === "trix" ? "" : ` (${multiplierLabel(e.contract, e.multiplier, e.forced)} for the picker)`}.`;
    case "kingDeclared":
      return `${who(e.seat)} declared the K♥: whoever takes it gets +200.`;
    case "trickWon":
      return `${who(e.seat)} took the trick.`;
    case "passed":
      return `${who(e.seat)} can't play and ${e.seat === you ? "pass" : "passes"}.`;
    case "extraTurn":
      return `${who(e.seat)} placed an ace and ${e.seat === you ? "play" : "plays"} again.`;
    case "playerFinished":
      return `${who(e.seat)} ${e.seat === you ? "are" : "is"} out, ${ordinal(e.place)} (${e.place === 1 ? "−100" : "−50"}).`;
    case "contractScored": {
      const parts = e.result.scores.map((sc, s) => `${name(s as Seat)} ${sc > 0 ? "+" : ""}${sc}`);
      return `${e.result.contract.toUpperCase()} is over: ${parts.join(", ")}.`;
    }
    case "gameOver":
      return `Game over. ${e.standings.losers.map(who).join(" and ")} ${e.standings.losers.length > 1 || e.standings.losers[0] === you ? "lose" : "loses"}.`;
    case "lastTrickShown":
      return "You looked at the last trick.";
    case "cardPlayed":
      return null;
  }
}
