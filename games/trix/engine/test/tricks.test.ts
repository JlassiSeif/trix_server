import { describe, expect, it } from "vitest";
import { legalActions, legalCards, viewFor } from "../src/index";
import { act, deal, playCards, reject, startContract } from "./helpers";

/**
 * The first contract of the 2026-09-23 smoke test (old C++ server + SDL clients), checked by
 * hand trick by trick. Seats: 0 lam3i, 1 bochra, 2 ldhaw, 3 klafez. lam3i picked dineri.
 */
export const SMOKE_DEAL = deal(
  "k_h;k_c;8_c;k_d;a_s;10_s;9_s;7_s",
  "q_h;j_c;7_c;a_d;q_d;9_d;k_s;j_s",
  "a_h;10_h;j_h;q_c;10_d;j_d;8_d;8_s",
  "9_h;8_h;7_h;a_c;10_c;9_c;7_d;q_s",
);
export const SMOKE_TRICKS = [
  "k_d;q_d;10_d;7_d", // → ldhaw (10 beats K)
  "8_d;9_h;k_h;a_d", // → bochra
  "j_c;q_c;10_c;8_c", // → klafez
  "a_c;k_c;7_c;8_s", // → klafez
  "9_c;10_s;9_d;a_h", // → klafez (off-suit ace doesn't win)
  "8_h;a_s;q_h;10_h", // → ldhaw
  "j_h;7_h;9_s;k_s", // → ldhaw
  "j_d;q_s;7_s;j_s", // → ldhaw
];

describe("R-TRICK-1: the picker leads the first trick", () => {
  it("gives the first turn to the picker", () => {
    expect(startContract("pli", SMOKE_DEAL, 2).state.turn).toBe(2);
  });
});

describe("R-TRICK-2: follow the led suit if you can, otherwise anything", () => {
  it("restricts a player holding the led suit to that suit, with no need to play higher", () => {
    let s = startContract("dineri", SMOKE_DEAL, 0).state;
    s = playCards(s, "k_d").state;
    expect(legalCards(s, 1).sort()).toEqual(["9_d", "a_d", "q_d"]);
    reject(s, 1, { type: "play", card: "j_c" }, "MUST_FOLLOW_SUIT");
    act(s, 1, { type: "play", card: "9_d" }); // lower than K♦ is fine
  });

  it("lets a player without the led suit play any card", () => {
    let s = startContract("dineri", SMOKE_DEAL, 0).state;
    s = playCards(s, SMOKE_TRICKS[0]!).state;
    s = playCards(s, "8_d").state; // ldhaw leads ♦; klafez has none left
    expect(legalCards(s, 3)).toHaveLength(7);
  });

  it("rejects plays out of turn, cards not held, and junk", () => {
    const s = startContract("dineri", SMOKE_DEAL, 0).state;
    reject(s, 2, { type: "play", card: "10_d" }, "NOT_YOUR_TURN");
    reject(s, 0, { type: "play", card: "q_h" }, "CARD_NOT_IN_HAND");
    reject(s, 0, { type: "play", card: "11_x" }, "BAD_ACTION");
    reject(s, 0, { type: "dance" }, "BAD_ACTION");
    reject(s, 0, null, "BAD_ACTION");
    reject(s, 7 as never, { type: "play", card: "k_d" }, "BAD_ACTION");
  });
});

describe("R-TRICK-3 / R-TRICK-4 / R-TRICK-5: winner, next leader, won pile", () => {
  it("gives the trick to the highest card of the led suit, who then leads", () => {
    let s = startContract("dineri", SMOKE_DEAL, 0).state;
    const r = playCards(s, SMOKE_TRICKS[0]!);
    s = r.state;
    expect(r.events).toContainEqual(expect.objectContaining({ type: "trickWon", seat: 2 }));
    expect(s.turn).toBe(2);
    expect(s.won[2]!.sort()).toEqual(["10_d", "7_d", "k_d", "q_d"]);
  });

  it("never lets an off-suit card win, even an ace", () => {
    let s = startContract("dineri", SMOKE_DEAL, 0).state;
    s = playCards(s, SMOKE_TRICKS.slice(0, 5).join(";")).state;
    expect(s.lastTrick!.winner).toBe(3);
  });
});

describe("Golden: smoke-test dineri round (0 / 20 / 50 / 10)", () => {
  it("replays all 8 tricks with the hand-checked result", () => {
    const { state, events } = playCards(startContract("dineri", SMOKE_DEAL, 0).state, SMOKE_TRICKS.join(";"));
    const winners = events.flatMap((e) => (e.type === "trickWon" ? [e.seat] : []));
    expect(winners).toEqual([2, 1, 3, 3, 3, 2, 2, 2]);
    expect(state.phase).toBe("contractEnd");
    expect(state.history[0]!.scores).toEqual([0, 20, 50, 10]); // lam3i picked: 0 × 2 = 0
    expect(state.totals).toEqual([0, 20, 50, 10]);
  });
});

describe("R-TRICK-6: completed tricks are face down; the last one can be looked at twice", () => {
  it("allows two looks per contract, to anyone at any moment, privately", () => {
    let s = startContract("dineri", SMOKE_DEAL, 0).state;
    reject(s, 1, { type: "peekLastTrick" }, "CANNOT_PEEK"); // no completed trick yet
    s = playCards(s, SMOKE_TRICKS[0]!).state;
    expect(viewFor(s, 3)).toMatchObject({ lastTrickExists: true, peeksLeft: 2 });
    expect(viewFor(s, 3)).not.toHaveProperty("lastTrick");

    const first = act(s, 3, { type: "peekLastTrick" }); // not seat 3's turn: still allowed
    expect(first.events).toEqual([
      { type: "lastTrickShown", seat: 3, winner: 2, cards: s.lastTrick!.cards },
    ]);
    s = act(first.state, 3, { type: "peekLastTrick" }).state;
    expect(viewFor(s, 3).peeksLeft).toBe(0);
    expect(legalActions(s, 3)).toEqual([]);
    reject(s, 3, { type: "peekLastTrick" }, "CANNOT_PEEK");
    expect(viewFor(s, 1).peeksLeft).toBe(2); // other seats keep theirs
  });

  it("resets the looks with every new contract", () => {
    let s = playCards(startContract("dineri", SMOKE_DEAL, 0).state, SMOKE_TRICKS.join(";")).state;
    reject(s, 0, { type: "peekLastTrick" }, "CANNOT_PEEK"); // contract over
    s = act(s, "system", { type: "nextContract" }).state;
    expect(viewFor(s, 0).peeksLeft).toBe(2);
    expect(viewFor(s, 0).lastTrickExists).toBe(false);
  });
});
