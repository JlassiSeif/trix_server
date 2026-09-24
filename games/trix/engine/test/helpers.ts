import { expect } from "vitest";
import {
  applyAction,
  createGame,
  type Action,
  type Actor,
  type CardId,
  type Contract,
  type GameEvent,
  type GameState,
  type Seat,
} from "../src/index";

/** Parse "k_h;10_d;..." into card ids. */
export const cards = (s: string) => s.split(";").map((c) => c.trim()) as CardId[];

/** A deal from four "a;b;c" strings. */
export const deal = (...hands: string[]) => hands.map(cards);

/** Each seat holds one full suit: seat 0 ♥, seat 1 ♣, seat 2 ♦, seat 3 ♠. */
export const SUIT_PER_SEAT = deal(
  "7_h;8_h;9_h;j_h;q_h;k_h;10_h;a_h",
  "7_c;8_c;9_c;j_c;q_c;k_c;10_c;a_c",
  "7_d;8_d;9_d;j_d;q_d;k_d;10_d;a_d",
  "7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s",
);

/** Seat 0 has no jack; seat 1 holds j_h and j_c. */
export const NO_JACK_FOR_0 = deal(
  "7_h;8_h;9_h;q_h;k_h;10_h;a_h;7_c",
  "j_h;8_c;9_c;j_c;q_c;k_c;10_c;a_c",
  "7_d;8_d;9_d;j_d;q_d;k_d;10_d;a_d",
  "7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s",
);

/** Apply an action that must succeed; returns the new state and its events. */
export function act(state: GameState, actor: Actor, action: Action): { state: GameState; events: GameEvent[] } {
  const r = applyAction(state, actor, action);
  if (!r.ok) throw new Error(`Expected ${JSON.stringify(action)} by ${actor} to succeed: ${r.error.code} ${r.error.message}`);
  return { state: r.state, events: r.events };
}

/** Apply an action that must fail with the given code, and check the state was not touched. */
export function reject(state: GameState, actor: Actor, action: unknown, code: string): void {
  const before = JSON.stringify(state);
  const r = applyAction(state, actor, action);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe(code);
  expect(JSON.stringify(state)).toBe(before);
}

/** New game with fixed hands where `picker` picks `contract` straight away. */
export function startContract(
  contract: Contract,
  hands: CardId[][],
  picker: Seat = 0,
): { state: GameState; events: GameEvent[] } {
  const game = createGame({ seed: 1, firstPicker: picker, presetDeals: [hands] });
  return act(game, picker, { type: "pick", contract });
}

/** Play cards in order, each by whoever's turn it is. Collects all events. */
export function playCards(state: GameState, list: string): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  for (const c of cards(list)) {
    const seat = state.turn;
    if (seat === null) throw new Error(`No one's turn when trying to play ${c}`);
    const r = act(state, seat, { type: "play", card: c });
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}
