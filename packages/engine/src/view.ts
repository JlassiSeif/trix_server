// What one player is allowed to see. The server sends only this to each browser, so other
// players' hands and won piles never leave the server.

import type { CardId, Seat, Suit } from "./cards";
import type { Contract } from "./scoring";
import {
  MAX_CONTRACTS,
  PEEKS_PER_CONTRACT,
  legalActions,
  type Action,
  type ContractResult,
  type GameState,
  type Phase,
  type PlayedCard,
  type Standings,
  type TrixStack,
} from "./game";

export interface PlayerView {
  seat: Seat;
  phase: Phase;
  contractNo: number;
  maxContracts: number;
  picker: Seat;
  contract: Contract | null;
  multiplier: number;
  forced: boolean;
  turn: Seat | null;
  /** Your own cards only. */
  hand: CardId[];
  /** How many cards each seat holds. */
  handCounts: number[];
  trick: PlayedCard[];
  /** Tricks won per seat this contract. Won tricks are face down (R-TRICK-6). */
  tricksWon: number[];
  /** Whether a completed trick exists to look at, and how many looks you have left (R-TRICK-6). */
  lastTrickExists: boolean;
  peeksLeft: number;
  kingDeclaredBy: Seat | null;
  stacks: Record<Suit, TrixStack | null>;
  finishers: Seat[];
  totals: number[];
  /** Contracts each seat has already picked (public knowledge). */
  used: Contract[][];
  history: ContractResult[];
  standings: Standings | null;
  /** Everything you may do right now. */
  legal: Action[];
}

export function viewFor(state: GameState, seat: Seat): PlayerView {
  return structuredClone({
    seat,
    phase: state.phase,
    contractNo: state.contractNo,
    maxContracts: MAX_CONTRACTS,
    picker: state.picker,
    contract: state.contract,
    multiplier: state.multiplier,
    forced: state.forced,
    turn: state.turn,
    hand: state.hands[seat]!,
    handCounts: state.hands.map((h) => h.length),
    trick: state.trick,
    tricksWon: state.tricksWon,
    lastTrickExists: state.lastTrick !== null,
    peeksLeft: PEEKS_PER_CONTRACT - state.peeksUsed[seat]!,
    kingDeclaredBy: state.kingDeclaredBy,
    stacks: state.stacks,
    finishers: state.finishers,
    totals: state.totals,
    used: state.used,
    history: state.history,
    standings: state.standings,
    legal: legalActions(state, seat),
  });
}
