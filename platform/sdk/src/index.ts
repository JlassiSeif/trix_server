// The game contract (docs/architecture.md §4): what a game provides so the platform can run it.
// The platform owns rooms, seats, invites, reconnecting, pauses, bot scheduling, persistence and
// security; a game owns its rules, its bots, its pacing and its screens. The platform never looks
// inside a game's state, moves, views or events: it only passes them through this contract.

/** Bumped when the contract changes; each game says which version it was written for. */
export const SDK_VERSION = "1.0.0";

/** Seats are numbered from 0. Turn order and teams are the game's business. */
export type Seat = number;
/** "system" is the platform acting on a game's behalf, e.g. dealing the next round after a break. */
export type Actor = Seat | "system";

export interface GameEventBase {
  type: string;
}

export type ApplyResult<S, E> = { ok: true; state: S; events: E[] } | { ok: false; error: { code: string; message: string } };

export interface GameResult {
  /** Seats from best to worst. */
  order: Seat[];
  winners: Seat[];
  losers: Seat[];
}

/**
 * Where a game is, as the platform needs to know it:
 * - playing: seats act (see `actors`);
 * - break: between rounds; everyone sees a summary with Continue, and after `seconds` (or when
 *   every human continued) the platform applies `next` as the system;
 * - over: the result screen; the platform offers "play again".
 */
export type GameStatus = { kind: "playing" } | { kind: "break"; next: unknown; seconds: number } | { kind: "over"; result: GameResult };

export interface BotThinking {
  /** Hard bots: deals to imagine per move, and a time budget in ms. */
  samples?: number;
  budgetMs?: number;
}

export interface GameMeta {
  /** URL-safe id: /<id>, and in saved rooms. */
  id: string;
  name: string;
  /** The game's own version (games/<id>/package.json). */
  version: string;
  /** The SDK_VERSION this game was written against. */
  sdk: string;
  seats: { min: number; max: number };
  /** Bot levels the game offers, and the one that stands in for a missing player. */
  botLevels: readonly string[];
  standInLevel: string;
}

export interface GameModule<S = unknown, V = unknown, E extends GameEventBase = GameEventBase> {
  meta: GameMeta;
  /** A new game. `seats` is how many players sit at the table. */
  create(opts: { seed: number; seats: number }): S;
  /** Events to send when a game has just been created (e.g. "cards dealt"). */
  started(state: S): E[];
  /** Validate and apply a move. Never throws on bad input; never mutates `state`. */
  apply(state: S, actor: Actor, action: unknown): ApplyResult<S, E>;
  /** What one seat may see, including the moves it may make now. Never another seat's secrets. */
  view(state: S, seat: Seat): V;
  /** The seat an event is for, or null if every seat may see it. */
  privateTo(event: E): Seat | null;
  /** Seats that may act now (any number: not every game is turn by turn). Bots act for these. */
  actors(state: S): Seat[];
  status(state: S): GameStatus;
  /** A new round starts with this event: bots forget the previous round's public events. */
  isRoundStart(event: E): boolean;
  /** How long a bot waits before acting (ms, at normal speed), given what just happened. */
  pace(state: S, events: readonly E[]): number;
  /** A bot's move, from exactly what a player in its seat knows: its view and the round's public events. */
  bot(level: string, view: V, events: readonly E[], rng: () => number, thinking: BotThinking): unknown | null;
  /** A simple legal move for `seat`, used if a bot ever fails. */
  fallback(state: S, seat: Seat): unknown | null;
  /** Optional: a log line for notable events (scores, game over), for operations. */
  logLine?(event: E): { event: string; fields: Record<string, unknown> } | null;
}

/** A small seeded random source in [0, 1) (mulberry32), for bots and tests. */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
