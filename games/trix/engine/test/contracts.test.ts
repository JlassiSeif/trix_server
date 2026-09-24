import { describe, expect, it } from "vitest";
import { applyMultipliers, canDeclareKing, createGame, legalCards, rawTrickScores, type Seat, type TrickOutcome } from "../src/index";
import { SUIT_PER_SEAT, act, cards, deal, playCards, reject, startContract } from "./helpers";

/** Won piles from "a;b" strings ("" for none), for scoring functions. */
function outcome(piles: string[], tricksWon: number[], lastTrickWinner: Seat | null = null, kingDeclaredBy: Seat | null = null): TrickOutcome {
  return { won: piles.map((p) => (p ? cards(p) : [])), tricksWon, lastTrickWinner, kingDeclaredBy };
}

const ALL_DIAMONDS = "7_d;8_d;9_d;j_d;q_d;k_d;10_d;a_d";

/** Seat 0 plays hearts and wins every trick it leads; its 8 leads, in order. */
const HEARTS_UP = "7_h;8_h;9_h;j_h;q_h;k_h;10_h;a_h".split(";");
/** Seat 0 leads the i-th heart and seats 1-3 discard the i-th card of their suit. */
function sweepTricks(n: number): string {
  const others = (suit: string) => ["7", "8", "9", "j", "q", "k", "10", "a"].map((r) => `${r}_${suit}`);
  const [c, d, s] = [others("c"), others("d"), others("s")];
  return Array.from({ length: n }, (_, i) => [HEARTS_UP[i], c[i], d[i], s[i]].join(";")).join(";");
}

describe("Dineri", () => {
  it("R-DIN-1: +10 per diamond taken", () => {
    expect(rawTrickScores("dineri", outcome(["7_d;8_d;9_d;j_d;q_d", "", "k_d;10_d;a_d", ""], [2, 0, 1, 0]))).toEqual([50, 0, 30, 0]);
  });

  it("R-DIN-2: all 8 diamonds score 150 instead of 80", () => {
    expect(rawTrickScores("dineri", outcome([ALL_DIAMONDS, "", "", ""], [2, 0, 0, 0]))[0]).toBe(150);
  });

  it("R-DIN-3: ends after the trick with the last diamond (and the picker's sweep is ×2)", () => {
    // Seat 0 leads hearts; seats 1 and 2 discard all their diamonds in 4 tricks.
    const split = deal(
      "7_h;8_h;9_h;j_h;q_h;k_h;10_h;a_h",
      "7_d;8_d;9_d;j_d;7_c;8_c;9_c;j_c",
      "q_d;k_d;10_d;a_d;q_c;k_c;10_c;a_c",
      "7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s",
    );
    const { state } = playCards(startContract("dineri", split).state, "7_h;7_d;q_d;7_s;8_h;8_d;k_d;8_s;9_h;9_d;10_d;9_s;j_h;j_d;a_d;j_s");
    expect(state.tricksPlayed).toBe(4);
    expect(state.phase).toBe("contractEnd");
    expect(state.history[0]!.scores).toEqual([300, 0, 0, 0]);
  });
});

describe("Damet", () => {
  it("R-DAM-1: +20 per queen", () => {
    expect(rawTrickScores("damet", outcome(["q_h;q_s", "q_d", "", ""], [1, 1, 0, 0]))).toEqual([40, 20, 0, 0]);
  });

  it("R-DAM-2: ends after the trick with the last queen, no bonus for all 4", () => {
    const { state } = playCards(startContract("damet", SUIT_PER_SEAT).state, "7_h;q_c;q_d;q_s;q_h;7_c;7_d;7_s");
    expect(state.tricksPlayed).toBe(2);
    expect(state.history[0]!.raw).toEqual([80, 0, 0, 0]);
    expect(state.history[0]!.scores).toEqual([160, 0, 0, 0]); // picker ×2
  });
});

describe("Pli", () => {
  it("R-PLI-1: +10 per trick", () => {
    expect(rawTrickScores("pli", outcome(["", "", "", ""], [3, 2, 2, 1]))).toEqual([30, 20, 20, 10]);
  });

  it("R-PLI-2: all 8 tricks score 150 instead of 80", () => {
    const { state } = playCards(startContract("pli", SUIT_PER_SEAT).state, sweepTricks(8));
    expect(state.history[0]!.raw).toEqual([150, 0, 0, 0]);
    expect(state.history[0]!.scores).toEqual([300, 0, 0, 0]);
  });
});

describe("Farcha", () => {
  it("R-FAR-1: only the 8th trick counts, +100", () => {
    expect(rawTrickScores("farcha", outcome(["", "", "", ""], [5, 1, 1, 1], 2))).toEqual([0, 0, 100, 0]);
    const { state } = playCards(startContract("farcha", SUIT_PER_SEAT).state, sweepTricks(8));
    expect(state.tricksPlayed).toBe(8);
    expect(state.history[0]!.scores).toEqual([200, 0, 0, 0]);
  });
});

describe("Ray", () => {
  /** Seat 1 holds K♥ as its only heart; seat 0 holds the other hearts. */
  const kingAt1 = deal(
    "7_h;8_h;9_h;j_h;q_h;10_h;a_h;7_c",
    "k_h;8_c;9_c;j_c;q_c;k_c;10_c;a_c",
    "7_d;8_d;9_d;j_d;q_d;k_d;10_d;a_d",
    "7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s",
  );

  it("R-RAY-1 / R-RAY-2: +100 to whoever takes K♥, and the contract ends there", () => {
    const { state } = playCards(startContract("ray", SUIT_PER_SEAT).state, "7_h;7_c;7_d;7_s;k_h;8_c;8_d;8_s");
    expect(state.tricksPlayed).toBe(2);
    expect(state.phase).toBe("contractEnd");
    expect(state.history[0]!.raw).toEqual([100, 0, 0, 0]);
    expect(state.history[0]!.scores).toEqual([200, 0, 0, 0]);
  });

  it("R-RAY-3: the holder may declare on their first turn, before their first card", () => {
    let s = startContract("ray", kingAt1).state;
    expect(canDeclareKing(s, 1)).toBe(false); // not their turn yet
    reject(s, 0, { type: "declareKing" }, "CANNOT_DECLARE"); // seat 0 doesn't hold K♥
    s = playCards(s, "7_h").state;
    expect(canDeclareKing(s, 1)).toBe(true);
    s = act(s, 1, { type: "declareKing" }).state;
    reject(s, 1, { type: "declareKing" }, "CANNOT_DECLARE"); // only once
    expect(s.kingDeclaredBy).toBe(1);
  });

  it("R-RAY-3: playing a card without declaring closes the window", () => {
    const s = playCards(startContract("ray", SUIT_PER_SEAT).state, "7_h").state; // seat 0 holds K♥, played without declaring
    expect(canDeclareKing(s, 0)).toBe(false);
  });

  it("R-RAY-3: no declaring outside ray and general", () => {
    reject(startContract("dineri", SUIT_PER_SEAT).state, 0, { type: "declareKing" }, "CANNOT_DECLARE");
  });

  it("R-RAY-4 / R-RAY-5: a declarer forced to play K♥ (only heart, hearts led) and taking it scores 200", () => {
    let s = startContract("ray", kingAt1).state;
    s = playCards(s, "7_h").state;
    s = act(s, 1, { type: "declareKing" }).state;
    expect(legalCards(s, 1)).toEqual(["k_h"]);
    s = playCards(s, "k_h;7_d;7_s").state;
    expect(s.history[0]!.scores).toEqual([0, 200, 0, 0]); // no −50: the declarer took it
  });

  it("R-RAY-6 / R-MULT-4: someone else takes a declared K♥: +200 (×2 for the picker), declarer −50", () => {
    let s = startContract("ray", kingAt1).state;
    s = playCards(s, "a_h").state;
    s = act(s, 1, { type: "declareKing" }).state;
    s = playCards(s, "k_h;7_d;7_s").state;
    expect(s.history[0]!.kingTakenBy).toBe(0);
    expect(s.history[0]!.scores).toEqual([400, -50, 0, 0]);
  });

  it("R-RAY-6: the declarer's −50 is not multiplied when the declarer is the picker", () => {
    const declarerPicks = deal(
      "k_h;8_h;9_h;j_h;q_h;10_h;7_h;7_c",
      "a_h;8_c;9_c;j_c;q_c;k_c;10_c;a_c",
      "7_d;8_d;9_d;j_d;q_d;k_d;10_d;a_d",
      "7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s",
    );
    let s = startContract("ray", declarerPicks).state;
    s = act(s, 0, { type: "declareKing" }).state;
    s = playCards(s, "k_h;a_h;7_d;7_s").state;
    expect(s.history[0]!.scores).toEqual([-50, 200, 0, 0]);
  });
});

describe("General", () => {
  it("R-GEN-1: all five contracts at once (a queen of diamonds counts twice)", () => {
    const won = ["q_d;7_d;q_c;k_h;7_s;8_s;9_s;7_c;8_c;9_c;7_h;8_h", "", "", ""];
    // dineri 20 + damet 40 + pli 30 + farcha 100 + ray 100
    expect(rawTrickScores("general", outcome(won, [3, 2, 2, 1], 0))[0]).toBe(290);
  });

  it("R-GEN-1: the special rules apply inside general (all diamonds = 150)", () => {
    // dineri 150 + damet 20 (q_d) + pli 20
    expect(rawTrickScores("general", outcome(["", ALL_DIAMONDS, "", ""], [4, 2, 1, 1], 0))[1]).toBe(190);
  });

  it("R-GEN-1: a declared K♥ taken by someone else costs the declarer 50 in general too", () => {
    const raw = rawTrickScores("general", outcome(["k_h", "", "", ""], [8, 0, 0, 0], 0, 2));
    expect(applyMultipliers({ contract: "general", raw, picker: 1, multiplier: 2, kingDeclaredBy: 2, kingTakenBy: 0 })[2]).toBe(-50);
  });

  it("R-GEN-2 / R-GEN-3: never ends early; taking all 8 tricks scores 0", () => {
    const { state } = playCards(startContract("general", SUIT_PER_SEAT).state, sweepTricks(8));
    expect(state.tricksPlayed).toBe(8); // K♥, all queens and all diamonds fell earlier
    expect(state.history[0]!.scores).toEqual([0, 0, 0, 0]);
  });
});

describe("Multipliers", () => {
  it("R-MULT-1: only the picker's score is ×2", () => {
    expect(applyMultipliers({ contract: "pli", raw: [10, 20, 30, 20], picker: 1, multiplier: 2, kingDeclaredBy: null, kingTakenBy: null })).toEqual([
      10, 40, 30, 20,
    ]);
  });

  it("R-MULT-2: the 7th (forced) pick is ×4", () => {
    const g = createGame({ seed: 1, firstPicker: 0, presetDeals: [SUIT_PER_SEAT] });
    g.used[0] = ["dineri", "pli", "farcha", "ray", "general", "trix"];
    let s = act(g, 0, { type: "pick", contract: "damet" }).state;
    expect(s.forced).toBe(true);
    expect(s.multiplier).toBe(4);
    s = playCards(s, "7_h;q_c;q_d;q_s;q_h;7_c;7_d;7_s").state;
    expect(s.history[0]!.scores).toEqual([320, 0, 0, 0]);
  });
});
