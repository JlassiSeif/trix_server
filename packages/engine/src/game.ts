// The game state machine. Pure: no I/O, no clocks, no Math.random. Randomness comes from
// the seeded PRNG stored in the state, so a game can be replayed from its seed.
// Rule IDs refer to RULES.md.

import {
  DECK,
  SEATS,
  isCardId,
  nextRandom,
  nextSeat,
  rankIndex,
  rankOf,
  shuffle,
  sortHand,
  suitOf,
  type CardId,
  type Seat,
  type Suit,
} from "./cards";
import {
  CONTRACTS,
  KING_OF_HEARTS,
  applyMultipliers,
  kingTakenBy,
  rawTrickScores,
  trixScores,
  type Contract,
} from "./scoring";

export const MAX_CONTRACTS = 28; // R-GAME-2: 4 players × 7 contracts
export const SCORE_LIMIT = 1000; // R-GAME-6
export const PEEKS_PER_CONTRACT = 2; // R-TRICK-6

export type Phase = "picking" | "tricks" | "trix" | "contractEnd" | "gameOver";

export interface PlayedCard {
  seat: Seat;
  card: CardId;
}

/** A trix stack: the lowest and highest rank placed so far, as R-DECK-2 indices. */
export interface TrixStack {
  low: number;
  high: number;
}

export interface ContractResult {
  contractNo: number;
  contract: Contract;
  picker: Seat;
  /** 2, or 4 for a forced 7th pick; 1 for trix (R-MULT-1..3). */
  multiplier: number;
  forced: boolean;
  /** Points per seat before multipliers and the declarer's −50. */
  raw: number[];
  /** What was added to each total. */
  scores: number[];
  /** Seats whose total hit exactly 1000 and was reset to 0 (R-GAME-6). */
  resetToZero: Seat[];
  /** Totals after this contract, resets included. */
  totals: number[];
  kingDeclaredBy: Seat | null;
  kingTakenBy: Seat | null;
  /** Trix only: seats in the order they emptied their hands. */
  finishers: Seat[];
}

export interface Standings {
  reason: "overLimit" | "allContractsPlayed";
  /** Seats ordered from lowest total (best) to highest. */
  order: Seat[];
  totals: number[];
  /** Lowest total; several seats on a tie (R-GAME-9). */
  winners: Seat[];
  /** Highest total, shown first on the result screen (R-GAME-10). */
  losers: Seat[];
}

export interface GameState {
  rng: number;
  /** Fixed deals for tests, used before any random deal. */
  presetDeals: CardId[][][];
  phase: Phase;
  /** 1-based number of the current (or last) contract. */
  contractNo: number;
  firstPicker: Seat;
  picker: Seat;
  /** Contracts each seat has picked (R-GAME-1). */
  used: Contract[][];
  totals: number[];
  hands: CardId[][];
  contract: Contract | null;
  multiplier: number;
  forced: boolean;
  /** Whose move it is, or null outside play. */
  turn: Seat | null;
  // Trick contracts
  trick: PlayedCard[];
  lastTrick: { cards: PlayedCard[]; winner: Seat } | null;
  tricksPlayed: number;
  won: CardId[][];
  tricksWon: number[];
  /** Whether each seat has played a card this contract (closes the K♥ declaration, R-RAY-3). */
  hasPlayed: boolean[];
  kingDeclaredBy: Seat | null;
  /** Looks at the last trick used by each seat this contract (R-TRICK-6). */
  peeksUsed: number[];
  // Trix
  stacks: Record<Suit, TrixStack | null>;
  finishers: Seat[];
  // Results
  history: ContractResult[];
  standings: Standings | null;
}

export type Action =
  | { type: "pick"; contract: Contract }
  | { type: "declareKing" }
  | { type: "peekLastTrick" }
  | { type: "play"; card: CardId }
  /** Deal the next contract after a contract ends. Sent by the server, not by a player. */
  | { type: "nextContract" };

export type Actor = Seat | "system";

export type GameEvent =
  | { type: "dealt"; contractNo: number; picker: Seat }
  | { type: "picked"; seat: Seat; contract: Contract; multiplier: number; forced: boolean }
  | { type: "kingDeclared"; seat: Seat }
  /** Private: only `seat` may see this (R-TRICK-6). */
  | { type: "lastTrickShown"; seat: Seat; cards: PlayedCard[]; winner: Seat }
  | { type: "cardPlayed"; seat: Seat; card: CardId }
  | { type: "trickWon"; seat: Seat; cards: PlayedCard[] }
  | { type: "passed"; seat: Seat }
  | { type: "extraTurn"; seat: Seat }
  | { type: "playerFinished"; seat: Seat; place: number }
  | { type: "contractScored"; result: ContractResult }
  | { type: "gameOver"; standings: Standings };

export type ErrorCode =
  | "BAD_ACTION"
  | "WRONG_PHASE"
  | "NOT_YOUR_TURN"
  | "SYSTEM_ONLY"
  | "ILLEGAL_CONTRACT"
  | "CARD_NOT_IN_HAND"
  | "MUST_FOLLOW_SUIT"
  | "ILLEGAL_TRIX_PLAY"
  | "CANNOT_DECLARE"
  | "CANNOT_PEEK";

export interface EngineError {
  code: ErrorCode;
  message: string;
}

export type ApplyResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: EngineError };

export interface GameOptions {
  seed: number;
  /** Defaults to a seeded random seat (R-SEAT-2). */
  firstPicker?: Seat;
  /** Fixed hands for the first contracts, for tests: one entry per contract, 4 hands of 8. */
  presetDeals?: CardId[][][];
}

const fail = (code: ErrorCode, message: string): ApplyResult => ({ ok: false, error: { code, message } });
const isSeat = (v: unknown): v is Seat => v === 0 || v === 1 || v === 2 || v === 3;

// ---------------------------------------------------------------------------
// Creating a game and dealing

export function createGame(options: GameOptions): GameState {
  let rng = options.seed >>> 0;
  let firstPicker = options.firstPicker;
  if (firstPicker === undefined) {
    const [r, next] = nextRandom(rng);
    rng = next;
    firstPicker = Math.floor(r * 4) as Seat;
  }
  for (const deal of options.presetDeals ?? []) assertValidDeal(deal);

  const state: GameState = {
    rng,
    presetDeals: (options.presetDeals ?? []).map((d) => d.map((h) => [...h])),
    phase: "picking",
    contractNo: 1,
    firstPicker,
    picker: firstPicker,
    used: [[], [], [], []],
    totals: [0, 0, 0, 0],
    hands: [[], [], [], []],
    contract: null,
    multiplier: 1,
    forced: false,
    turn: null,
    trick: [],
    lastTrick: null,
    tricksPlayed: 0,
    won: [[], [], [], []],
    tricksWon: [0, 0, 0, 0],
    hasPlayed: [false, false, false, false],
    kingDeclaredBy: null,
    peeksUsed: [0, 0, 0, 0],
    stacks: { h: null, c: null, d: null, s: null },
    finishers: [],
    history: [],
    standings: null,
  };
  deal(state);
  return state;
}

function assertValidDeal(deal: CardId[][]): void {
  const all = deal.flat();
  if (deal.length !== 4 || deal.some((h) => h.length !== 8) || new Set(all).size !== 32 || !all.every(isCardId)) {
    throw new Error("A preset deal must be 4 hands of 8 distinct cards covering the 32-card deck");
  }
}

/** R-DECK-3: a fresh deal of 8 cards each, before the pick. Resets all per-contract state. */
function deal(state: GameState): void {
  let hands = state.presetDeals.shift();
  if (!hands) {
    const [shuffled, rng] = shuffle(DECK, state.rng);
    state.rng = rng;
    hands = SEATS.map((s) => shuffled.slice(s * 8, s * 8 + 8));
  }
  state.hands = hands.map(sortHand);
  state.phase = "picking";
  state.contract = null;
  state.multiplier = 1;
  state.forced = false;
  state.turn = state.picker;
  state.trick = [];
  state.lastTrick = null;
  state.tricksPlayed = 0;
  state.won = [[], [], [], []];
  state.tricksWon = [0, 0, 0, 0];
  state.hasPlayed = [false, false, false, false];
  state.kingDeclaredBy = null;
  state.peeksUsed = [0, 0, 0, 0];
  state.stacks = { h: null, c: null, d: null, s: null };
  state.finishers = [];
}

// ---------------------------------------------------------------------------
// What is legal

/** Contracts the picker may choose now (R-GAME-1, R-GAME-4, R-GAME-5, R-GAME-11). */
export function legalContracts(state: GameState, seat: Seat): Contract[] {
  if (state.phase !== "picking" || seat !== state.picker) return [];
  const remaining = CONTRACTS.filter((c) => !state.used[seat]!.includes(c));
  // R-GAME-11: trix is due by the 6th pick, with or without a jack (R-GAME-5).
  if (remaining.includes("trix") && state.used[seat]!.length >= 5) return ["trix"];
  if (remaining.length === 1) return remaining; // the 7th pick
  const hasJack = state.hands[seat]!.some((c) => rankOf(c) === "j");
  return remaining.filter((c) => c !== "trix" || hasJack);
}

/** Cards the seat may play now, in either play phase. */
export function legalCards(state: GameState, seat: Seat): CardId[] {
  if (state.turn !== seat) return [];
  const hand = state.hands[seat]!;
  if (state.phase === "tricks") {
    const lead = state.trick[0];
    if (!lead) return [...hand];
    const led = suitOf(lead.card);
    const following = hand.filter((c) => suitOf(c) === led);
    return following.length > 0 ? following : [...hand]; // R-TRICK-2
  }
  if (state.phase === "trix") return hand.filter((c) => fitsTrix(state.stacks, c));
  return [];
}

/** R-TRIX-1, R-TRIX-3: a jack opens its suit; otherwise the next rank up or down. */
function fitsTrix(stacks: Record<Suit, TrixStack | null>, c: CardId): boolean {
  const stack = stacks[suitOf(c)];
  if (!stack) return rankOf(c) === "j";
  const r = rankIndex(c);
  return r === stack.high + 1 || r === stack.low - 1;
}

/** R-RAY-3: the K♥ holder, on their turn, before playing their first card of the contract. */
export function canDeclareKing(state: GameState, seat: Seat): boolean {
  return (
    state.phase === "tricks" &&
    (state.contract === "ray" || state.contract === "general") &&
    state.turn === seat &&
    state.kingDeclaredBy === null &&
    !state.hasPlayed[seat] &&
    state.hands[seat]!.includes(KING_OF_HEARTS)
  );
}

/** R-TRICK-6: during a trick contract, once a trick is complete, at most twice per contract, at any moment. */
export function canPeekLastTrick(state: GameState, seat: Seat): boolean {
  return state.phase === "tricks" && state.lastTrick !== null && state.peeksUsed[seat]! < PEEKS_PER_CONTRACT;
}

/** Events only one seat may receive. Everything else is public. */
export function privateTo(event: GameEvent): Seat | null {
  return event.type === "lastTrickShown" ? event.seat : null;
}

/** Every action the actor may take right now. Looking at the last trick is the only one allowed off-turn. */
export function legalActions(state: GameState, actor: Actor): Action[] {
  if (actor === "system") return state.phase === "contractEnd" ? [{ type: "nextContract" }] : [];
  if (state.phase === "picking") return legalContracts(state, actor).map((contract) => ({ type: "pick", contract }));
  const actions: Action[] = [];
  if (canPeekLastTrick(state, actor)) actions.push({ type: "peekLastTrick" });
  if (canDeclareKing(state, actor)) actions.push({ type: "declareKing" });
  for (const card of legalCards(state, actor)) actions.push({ type: "play", card });
  return actions;
}

// ---------------------------------------------------------------------------
// Applying actions

/**
 * Validate and apply one action. Never throws on bad input: anything invalid comes back as
 * an error and the state is untouched. The input state is never mutated.
 */
export function applyAction(state: GameState, actor: Actor, action: unknown): ApplyResult {
  if (actor !== "system" && !isSeat(actor)) return fail("BAD_ACTION", "Unknown actor");
  if (typeof action !== "object" || action === null || !("type" in action)) return fail("BAD_ACTION", "Malformed action");
  const a = action as { type: unknown; contract?: unknown; card?: unknown };

  if (a.type === "nextContract") {
    if (actor !== "system") return fail("SYSTEM_ONLY", "Only the server deals the next contract");
    if (state.phase !== "contractEnd") return fail("WRONG_PHASE", "The contract is not over");
    const next = structuredClone(state);
    next.contractNo += 1;
    next.picker = nextSeat(next.picker); // R-GAME-2
    deal(next);
    return { ok: true, state: next, events: [{ type: "dealt", contractNo: next.contractNo, picker: next.picker }] };
  }
  if (actor === "system") return fail("BAD_ACTION", "The server can only deal the next contract");

  switch (a.type) {
    case "pick":
      return pick(state, actor, a.contract);
    case "declareKing":
      return declareKing(state, actor);
    case "peekLastTrick":
      return peekLastTrick(state, actor);
    case "play":
      if (!isCardId(a.card)) return fail("BAD_ACTION", "Unknown card");
      if (state.phase === "tricks") return playTrickCard(state, actor, a.card);
      if (state.phase === "trix") return playTrixCard(state, actor, a.card);
      return fail("WRONG_PHASE", "Cards cannot be played now");
    default:
      return fail("BAD_ACTION", "Unknown action type");
  }
}

function pick(state: GameState, seat: Seat, contract: unknown): ApplyResult {
  if (state.phase !== "picking") return fail("WRONG_PHASE", "Not picking a contract now");
  if (seat !== state.picker) return fail("NOT_YOUR_TURN", "Only the picker chooses the contract");
  if (!legalContracts(state, seat).includes(contract as Contract)) {
    return fail("ILLEGAL_CONTRACT", `Cannot pick ${String(contract)} now`);
  }
  const next = structuredClone(state);
  const c = contract as Contract;
  next.used[seat]!.push(c);
  next.contract = c;
  next.forced = next.used[seat]!.length === 7; // R-MULT-2: the 7th pick
  next.multiplier = c === "trix" ? 1 : next.forced ? 4 : 2; // R-MULT-1..3
  const events: GameEvent[] = [{ type: "picked", seat, contract: c, multiplier: next.multiplier, forced: next.forced }];
  next.turn = seat; // R-TRICK-1, R-TRIX-2: the picker moves first
  if (c === "trix") {
    next.phase = "trix";
    advanceTrixTurn(next, seat, events); // with no jack, the picker passes (R-GAME-5, R-TRIX-2)
  } else {
    next.phase = "tricks";
  }
  return { ok: true, state: next, events };
}

function declareKing(state: GameState, seat: Seat): ApplyResult {
  if (!canDeclareKing(state, seat)) return fail("CANNOT_DECLARE", "You cannot declare the king of hearts now");
  const next = structuredClone(state);
  next.kingDeclaredBy = seat;
  return { ok: true, state: next, events: [{ type: "kingDeclared", seat }] };
}

function peekLastTrick(state: GameState, seat: Seat): ApplyResult {
  if (!canPeekLastTrick(state, seat)) return fail("CANNOT_PEEK", "You cannot look at the last trick now");
  const next = structuredClone(state);
  next.peeksUsed[seat]! += 1;
  const { cards, winner } = next.lastTrick!;
  return { ok: true, state: next, events: [{ type: "lastTrickShown", seat, cards, winner }] };
}

function checkTurn(state: GameState, seat: Seat, card: CardId): ApplyResult | null {
  if (state.turn !== seat) return fail("NOT_YOUR_TURN", "It is not your turn");
  if (!state.hands[seat]!.includes(card)) return fail("CARD_NOT_IN_HAND", "That card is not in your hand");
  return null;
}

function playTrickCard(state: GameState, seat: Seat, card: CardId): ApplyResult {
  const bad = checkTurn(state, seat, card);
  if (bad) return bad;
  if (!legalCards(state, seat).includes(card)) return fail("MUST_FOLLOW_SUIT", "You must follow the led suit");

  const next = structuredClone(state);
  next.hands[seat] = next.hands[seat]!.filter((c) => c !== card);
  next.trick.push({ seat, card });
  next.hasPlayed[seat] = true;
  const events: GameEvent[] = [{ type: "cardPlayed", seat, card }];

  if (next.trick.length < 4) {
    next.turn = nextSeat(seat);
    return { ok: true, state: next, events };
  }

  // R-TRICK-3: highest card of the led suit wins; no trumps.
  const led = suitOf(next.trick[0]!.card);
  let best = next.trick[0]!;
  for (const p of next.trick) if (suitOf(p.card) === led && rankIndex(p.card) > rankIndex(best.card)) best = p;
  const winner = best.seat;
  const cards = next.trick;
  next.won[winner]!.push(...cards.map((p) => p.card)); // R-TRICK-5
  next.tricksWon[winner]! += 1;
  next.tricksPlayed += 1;
  next.lastTrick = { cards, winner };
  next.trick = [];
  events.push({ type: "trickWon", seat: winner, cards });

  if (trickContractOver(next)) {
    scoreContract(next, events);
  } else {
    next.turn = winner; // R-TRICK-4
  }
  return { ok: true, state: next, events };
}

/** 8 tricks, or an early ending (R-DIN-3, R-DAM-2, R-RAY-2). General never ends early (R-GEN-2). */
function trickContractOver(state: GameState): boolean {
  if (state.tricksPlayed === 8) return true;
  const taken = state.won.flat();
  switch (state.contract) {
    case "dineri":
      return taken.filter((c) => suitOf(c) === "d").length === 8;
    case "damet":
      return taken.filter((c) => rankOf(c) === "q").length === 4;
    case "ray":
      return taken.includes(KING_OF_HEARTS);
    default:
      return false;
  }
}

function playTrixCard(state: GameState, seat: Seat, card: CardId): ApplyResult {
  const bad = checkTurn(state, seat, card);
  if (bad) return bad;
  if (!legalCards(state, seat).includes(card)) return fail("ILLEGAL_TRIX_PLAY", "That card does not fit on the table");

  const next = structuredClone(state);
  next.hands[seat] = next.hands[seat]!.filter((c) => c !== card);
  const suit = suitOf(card);
  const r = rankIndex(card);
  const stack = next.stacks[suit];
  next.stacks[suit] = stack ? { low: Math.min(stack.low, r), high: Math.max(stack.high, r) } : { low: r, high: r };
  const events: GameEvent[] = [{ type: "cardPlayed", seat, card }];

  if (next.hands[seat]!.length === 0) {
    next.finishers.push(seat);
    events.push({ type: "playerFinished", seat, place: next.finishers.length });
    if (next.finishers.length === 2) {
      scoreContract(next, events); // R-TRIX-6: play stops at the second finisher
      return { ok: true, state: next, events };
    }
    advanceTrixTurn(next, nextSeat(seat), events);
  } else if (rankOf(card) === "a") {
    events.push({ type: "extraTurn", seat }); // R-TRIX-5
    advanceTrixTurn(next, seat, events);
  } else {
    advanceTrixTurn(next, nextSeat(seat), events);
  }
  return { ok: true, state: next, events };
}

/**
 * Give the turn to the first seat from `from` (counter-clockwise) that can play. Seats with
 * no legal card pass automatically (R-TRIX-4); finished seats are skipped.
 */
function advanceTrixTurn(state: GameState, from: Seat, events: GameEvent[]): void {
  let seat = from;
  for (let i = 0; i < 4; i++) {
    if (state.hands[seat]!.length > 0) {
      state.turn = seat;
      if (legalCards(state, seat).length > 0) return;
      events.push({ type: "passed", seat });
    }
    seat = nextSeat(seat);
  }
  // Unreachable while cards remain: the next card of some stack is always in someone's hand.
  throw new Error("Trix: no seat can play");
}

function scoreContract(state: GameState, events: GameEvent[]): void {
  const contract = state.contract!;
  let raw: number[];
  let scores: number[];
  const kingTaker = kingTakenBy(state.won);
  if (contract === "trix") {
    raw = trixScores(state.finishers);
    scores = [...raw];
  } else {
    raw = rawTrickScores(contract, {
      won: state.won,
      tricksWon: state.tricksWon,
      lastTrickWinner: state.tricksPlayed === 8 ? state.lastTrick!.winner : null,
      kingDeclaredBy: state.kingDeclaredBy,
    });
    scores = applyMultipliers({
      contract,
      raw,
      picker: state.picker,
      multiplier: state.multiplier,
      kingDeclaredBy: state.kingDeclaredBy,
      kingTakenBy: kingTaker,
    });
  }

  // R-GAME-6: add, reset exact 1000 to 0, then check for over 1000.
  const resetToZero: Seat[] = [];
  state.totals = state.totals.map((t, s) => {
    const total = t + scores[s]!;
    if (total === SCORE_LIMIT) {
      resetToZero.push(s as Seat);
      return 0;
    }
    return total;
  });

  const result: ContractResult = {
    contractNo: state.contractNo,
    contract,
    picker: state.picker,
    multiplier: state.multiplier,
    forced: state.forced,
    raw,
    scores,
    resetToZero,
    totals: [...state.totals],
    kingDeclaredBy: state.kingDeclaredBy,
    kingTakenBy: kingTaker,
    finishers: [...state.finishers],
  };
  state.history.push(result);
  state.turn = null;
  events.push({ type: "contractScored", result });

  const overLimit = state.totals.some((t) => t > SCORE_LIMIT);
  if (overLimit || state.contractNo >= MAX_CONTRACTS) {
    state.phase = "gameOver";
    state.standings = computeStandings(state.totals, overLimit ? "overLimit" : "allContractsPlayed");
    events.push({ type: "gameOver", standings: state.standings });
  } else {
    state.phase = "contractEnd";
  }
}

/** R-GAME-9, R-GAME-10: lowest total wins, highest loses, ties are ties. */
export function computeStandings(totals: number[], reason: Standings["reason"]): Standings {
  const order = [...SEATS].sort((a, b) => totals[a]! - totals[b]! || a - b);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  return {
    reason,
    order,
    totals: [...totals],
    winners: SEATS.filter((s) => totals[s] === min),
    losers: SEATS.filter((s) => totals[s] === max),
  };
}

