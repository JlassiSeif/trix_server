import { describe, expect, it } from "vitest";
import { computeStandings, createGame, legalCards, type GameState } from "../src/index";
import { NO_JACK_FOR_0, SUIT_PER_SEAT, act, playCards, reject, startContract } from "./helpers";

/** With one suit per seat, everyone builds their own stack: jacks, then up to the ace, then down. */
const FULL_TRIX =
  "j_h;j_c;j_d;j_s;q_h;q_c;q_d;q_s;k_h;k_c;k_d;k_s;10_h;10_c;10_d;10_s;" +
  "a_h;9_h;a_c;9_c;a_d;9_d;a_s;9_s;8_h;8_c;8_d;8_s;7_h;7_c";

describe("Trix", () => {
  it("R-TRIX-1: stacks open with the jack and build J→Q→K→10→A and J→9→8→7", () => {
    let s = startContract("trix", SUIT_PER_SEAT).state;
    expect(legalCards(s, 0)).toEqual(["j_h"]);
    s = playCards(s, "j_h;j_c;j_d;j_s").state;
    expect(legalCards(s, 0).sort()).toEqual(["9_h", "q_h"]);
    s = playCards(s, "q_h;q_c;q_d;q_s;k_h;k_c;k_d;k_s").state;
    expect(legalCards(s, 0).sort()).toEqual(["10_h", "9_h"]); // the 10 comes after the king, not the ace
    reject(s, 0, { type: "play", card: "a_h" }, "ILLEGAL_TRIX_PLAY");
  });

  it("R-TRIX-2: the picker opens, choosing which jack", () => {
    const s = startContract("trix", NO_JACK_FOR_0, 1).state;
    expect(s.turn).toBe(1);
    expect(legalCards(s, 1).sort()).toEqual(["j_c", "j_h"]);
  });

  it("R-TRIX-3 / R-TRIX-4: anyone can open another suit; a player with no legal card passes", () => {
    let s = startContract("trix", NO_JACK_FOR_0, 1).state;
    s = playCards(s, "j_c;j_d;j_s").state;
    // Seat 0 holds hearts (no jack yet on the table: j_h is still with seat 1) and 7_c: nothing fits.
    expect(s.turn).toBe(1);
    const r = act(s, 1, { type: "play", card: "j_h" });
    expect(r.state.turn).toBe(2);
  });

  it("R-TRIX-4: a seat with no legal card is passed automatically", () => {
    const s = startContract("trix", NO_JACK_FOR_0, 1).state;
    const { events } = playCards(s, "j_c;j_d;j_s");
    expect(events).toContainEqual({ type: "passed", seat: 0 });
  });

  it("R-TRIX-5: an ace gives an extra turn; with nothing playable after it, the player passes", () => {
    let s = startContract("trix", SUIT_PER_SEAT).state;
    s = playCards(s, "j_h;j_c;j_d;j_s;q_h;q_c;q_d;q_s;k_h;k_c;k_d;k_s;10_h;10_c;10_d;10_s").state;
    const r = act(s, 0, { type: "play", card: "a_h" });
    expect(r.events).toContainEqual({ type: "extraTurn", seat: 0 });
    expect(r.state.turn).toBe(0);

    // Hand-built position: seat 0 places its ace and has only an unplayable card left.
    const p: GameState = structuredClone(s);
    p.hands[0] = ["a_h", "7_d"]; // ♦ stack is at J..10, so a 7 doesn't fit
    const r2 = act(p, 0, { type: "play", card: "a_h" });
    expect(r2.events).toEqual(expect.arrayContaining([{ type: "extraTurn", seat: 0 }, { type: "passed", seat: 0 }]));
    expect(r2.state.turn).toBe(1);
  });

  it("R-TRIX-6 / R-TRIX-7: first out −100, second −50, play stops, no multiplier", () => {
    const { state, events } = playCards(startContract("trix", SUIT_PER_SEAT).state, FULL_TRIX);
    expect(events.filter((e) => e.type === "playerFinished")).toEqual([
      { type: "playerFinished", seat: 0, place: 1 },
      { type: "playerFinished", seat: 1, place: 2 },
    ]);
    expect(state.phase).toBe("contractEnd");
    expect(state.hands[2]).toEqual(["7_d"]); // the others stop with cards left
    expect(state.history[0]!.scores).toEqual([-100, -50, 0, 0]); // picker seat 0: not ×2
  });
});

/** Seat 0 picks ray with SUIT_PER_SEAT and takes K♥ in the first trick: +200 for seat 0. */
function rayFor200(totals: number[], contractNo = 1) {
  const g = createGame({ seed: 1, firstPicker: 0, presetDeals: [SUIT_PER_SEAT] });
  g.totals = totals;
  g.contractNo = contractNo;
  return playCards(act(g, 0, { type: "pick", contract: "ray" }).state, "k_h;7_c;7_d;7_s");
}

describe("End of game", () => {
  it("R-GAME-6: a total of exactly 1000 resets to 0 and play goes on", () => {
    const { state } = rayFor200([800, 0, 0, 0]);
    expect(state.totals).toEqual([0, 0, 0, 0]);
    expect(state.history[0]!.resetToZero).toEqual([0]);
    expect(state.phase).toBe("contractEnd");
  });

  it("R-GAME-6: strictly over 1000 ends the game", () => {
    const { state, events } = rayFor200([900, 50, 20, 300]);
    expect(state.phase).toBe("gameOver");
    expect(state.standings).toMatchObject({ reason: "overLimit", losers: [0], winners: [2] });
    expect(events.at(-1)).toMatchObject({ type: "gameOver" });
    reject(state, "system", { type: "nextContract" }, "WRONG_PHASE");
    reject(state, 0, { type: "pick", contract: "dineri" }, "WRONG_PHASE");
  });

  it("R-GAME-7: the game ends after the 28th contract", () => {
    const { state } = rayFor200([0, 0, 0, 0], 28);
    expect(state.standings).toMatchObject({ reason: "allContractsPlayed", losers: [0] });
  });

  it("R-GAME-8: totals can go negative", () => {
    const { state } = playCards(startContract("trix", SUIT_PER_SEAT).state, FULL_TRIX);
    expect(state.totals).toEqual([-100, -50, 0, 0]);
  });

  it("R-GAME-9 / R-GAME-10: lowest wins, highest loses, ties are ties", () => {
    const st = computeStandings([10, 10, 50, 50], "allContractsPlayed");
    expect(st.winners).toEqual([0, 1]);
    expect(st.losers).toEqual([2, 3]);
    expect(st.order).toEqual([0, 1, 2, 3]);
  });

  it("only the server deals the next contract, and only after one ends", () => {
    const { state } = rayFor200([0, 0, 0, 0]);
    reject(state, 0, { type: "nextContract" }, "SYSTEM_ONLY");
    reject(createGame({ seed: 1 }), "system", { type: "nextContract" }, "WRONG_PHASE");
    reject(createGame({ seed: 1 }), "system", { type: "play", card: "7_h" }, "BAD_ACTION");
  });
});
