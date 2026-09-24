import { describe, expect, it } from "vitest";
import { DECK, SEATS, createGame, legalContracts, nextSeat, rankIndex, suitOf, type CardId } from "../src/index";
import { NO_JACK_FOR_0, SUIT_PER_SEAT, act, playCards, reject } from "./helpers";

describe("R-DECK-1: 32 cards, 7 to A in four suits", () => {
  it("has 32 distinct cards, 8 per suit", () => {
    expect(new Set(DECK).size).toBe(32);
    for (const s of ["h", "c", "d", "s"]) expect(DECK.filter((c) => suitOf(c) === s)).toHaveLength(8);
  });
});

describe("R-DECK-2: rank order 7 8 9 J Q K 10 A", () => {
  it("puts the 10 above the king and below the ace", () => {
    const order: CardId[] = ["7_h", "8_h", "9_h", "j_h", "q_h", "k_h", "10_h", "a_h"];
    order.forEach((c, i) => expect(rankIndex(c)).toBe(i));
  });
});

describe("R-DECK-3: fresh deal of 8 each, before the pick", () => {
  it("deals 4 hands of 8 covering the whole deck", () => {
    const g = createGame({ seed: 42 });
    expect(g.phase).toBe("picking");
    expect(g.hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(new Set(g.hands.flat()).size).toBe(32);
  });

  it("is reproducible from the seed and differs between seeds", () => {
    expect(createGame({ seed: 7 }).hands).toEqual(createGame({ seed: 7 }).hands);
    expect(createGame({ seed: 7 }).hands).not.toEqual(createGame({ seed: 8 }).hands);
  });

  it("deals a new hand for every contract", () => {
    let s = createGame({ seed: 3, firstPicker: 0, presetDeals: [SUIT_PER_SEAT] });
    s = act(s, 0, { type: "pick", contract: "ray" }).state;
    s = playCards(s, "k_h;7_c;7_d;7_s").state; // K♥ taken: ray ends (R-RAY-2)
    s = act(s, "system", { type: "nextContract" }).state;
    expect(s.hands).not.toEqual(SUIT_PER_SEAT);
    expect(new Set(s.hands.flat()).size).toBe(32);
  });
});

describe("R-SEAT-1: turn order is counter-clockwise (seat n → n+1)", () => {
  it("cycles 0 → 1 → 2 → 3 → 0", () => {
    expect(SEATS.map(nextSeat)).toEqual([1, 2, 3, 0]);
  });
});

describe("R-SEAT-2: the first picker is random", () => {
  it("can be any seat, and is fixed by the seed", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 100; seed++) seen.add(createGame({ seed }).firstPicker);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    expect(createGame({ seed: 5 }).firstPicker).toBe(createGame({ seed: 5 }).firstPicker);
  });
});

describe("R-GAME-1: each player picks each of their own contracts once", () => {
  it("removes a player's used contracts from their options, ignoring other players' picks", () => {
    const g = createGame({ seed: 1, firstPicker: 0, presetDeals: [SUIT_PER_SEAT] });
    g.used[0] = ["dineri", "ray"];
    g.used[1] = ["damet"];
    expect(legalContracts(g, 0)).toEqual(["damet", "pli", "farcha", "general", "trix"]);
    reject(g, 0, { type: "pick", contract: "dineri" }, "ILLEGAL_CONTRACT");
  });

  it("only lets the picker pick, and only during picking", () => {
    const g = createGame({ seed: 1, firstPicker: 2 });
    reject(g, 0, { type: "pick", contract: "dineri" }, "NOT_YOUR_TURN");
    reject(g, 2, { type: "pick", contract: "belote" }, "ILLEGAL_CONTRACT");
    const s = act(g, 2, { type: "pick", contract: "pli" }).state;
    reject(s, 2, { type: "pick", contract: "dineri" }, "WRONG_PHASE");
  });
});

describe("R-GAME-2: the picker moves counter-clockwise after every contract", () => {
  it("passes the pick from seat 3 to seat 0 and counts contracts", () => {
    let s = createGame({ seed: 1, firstPicker: 3, presetDeals: [SUIT_PER_SEAT] });
    s = act(s, 3, { type: "pick", contract: "ray" }).state;
    // Seat 3 (spades) leads; seat 0 must follow with nothing, so it discards K♥; seat 3 takes it.
    s = playCards(s, "7_s;k_h;7_c;7_d").state;
    expect(s.phase).toBe("contractEnd");
    s = act(s, "system", { type: "nextContract" }).state;
    expect(s.picker).toBe(0);
    expect(s.contractNo).toBe(2);
    expect(s.turn).toBe(0);
  });
});

describe("R-GAME-3: each contract runs deal → pick → play → score", () => {
  it("moves through the phases in order", () => {
    const phases: string[] = [];
    let s = createGame({ seed: 1, firstPicker: 0, presetDeals: [SUIT_PER_SEAT] });
    phases.push(s.phase);
    s = act(s, 0, { type: "pick", contract: "ray" }).state;
    phases.push(s.phase);
    const { state, events } = playCards(s, "k_h;7_c;7_d;7_s");
    phases.push(state.phase);
    s = act(state, "system", { type: "nextContract" }).state;
    phases.push(s.phase);
    expect(phases).toEqual(["picking", "tricks", "contractEnd", "picking"]);
    expect(events.map((e) => e.type)).toEqual(["cardPlayed", "cardPlayed", "cardPlayed", "cardPlayed", "trickWon", "contractScored"]);
  });
});

describe("R-GAME-4: trix needs a jack", () => {
  it("is not offered to a picker without a jack while other contracts remain", () => {
    const g = createGame({ seed: 1, firstPicker: 0, presetDeals: [NO_JACK_FOR_0] });
    expect(legalContracts(g, 0)).not.toContain("trix");
    reject(g, 0, { type: "pick", contract: "trix" }, "ILLEGAL_CONTRACT");
  });

  it("is offered to a picker holding a jack", () => {
    const g = createGame({ seed: 1, firstPicker: 1, presetDeals: [NO_JACK_FOR_0] });
    expect(legalContracts(g, 1)).toContain("trix");
  });
});

describe("R-GAME-5: forced trix without a jack is still played", () => {
  it("lets the first counter-clockwise player with a jack open", () => {
    const g = createGame({ seed: 1, firstPicker: 0, presetDeals: [NO_JACK_FOR_0] });
    g.used[0] = ["dineri", "damet", "pli", "farcha", "ray"]; // 6th pick: trix is due (R-GAME-11)
    expect(legalContracts(g, 0)).toEqual(["trix"]);
    const { state, events } = act(g, 0, { type: "pick", contract: "trix" });
    expect(state.forced).toBe(false); // "forced" is the ×4 7th pick (R-MULT-2); trix is never that now
    expect(state.multiplier).toBe(1); // R-MULT-3
    expect(events).toContainEqual({ type: "passed", seat: 0 });
    expect(state.turn).toBe(1);
  });
});

describe("R-GAME-11: trix is due by the 6th pick", () => {
  it("offers only trix at the 6th pick, even with a jack and another contract left", () => {
    const g = createGame({ seed: 1, firstPicker: 1, presetDeals: [NO_JACK_FOR_0] });
    g.used[1] = ["dineri", "damet", "pli", "farcha", "ray"];
    expect(legalContracts(g, 1)).toEqual(["trix"]);
    reject(g, 1, { type: "pick", contract: "general" }, "ILLEGAL_CONTRACT");
  });

  it("leaves the choice open before the 6th pick", () => {
    const g = createGame({ seed: 1, firstPicker: 1, presetDeals: [NO_JACK_FOR_0] });
    g.used[1] = ["dineri", "damet", "pli", "farcha"];
    expect(legalContracts(g, 1)).toEqual(["ray", "general", "trix"]);
  });

  it("makes the 7th pick a trick contract at ×4", () => {
    const g = createGame({ seed: 1, firstPicker: 1, presetDeals: [NO_JACK_FOR_0] });
    g.used[1] = ["dineri", "damet", "pli", "trix", "farcha", "ray"];
    expect(legalContracts(g, 1)).toEqual(["general"]);
    const { state } = act(g, 1, { type: "pick", contract: "general" });
    expect([state.forced, state.multiplier]).toEqual([true, 4]);
  });
});
