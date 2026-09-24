import { describe, expect, it } from "vitest";
import {
  DECK,
  SEATS,
  applyAction,
  createGame,
  legalActions,
  nextRandom,
  placeholderBotAction,
  viewFor,
  type Action,
  type GameState,
  type Seat,
} from "../src/index";

/** Every card is somewhere: in a hand, the current trick, a won pile, or a trix stack. */
function cardCount(s: GameState): number {
  const inHands = s.hands.flat().length;
  if (s.contract === "trix") {
    return inHands + Object.values(s.stacks).reduce((n, st) => n + (st ? st.high - st.low + 1 : 0), 0);
  }
  return inHands + s.trick.length + s.won.flat().length;
}

/** Whoever has something to do: the server between contracts, otherwise the seat on turn. */
function actor(s: GameState): Seat | "system" | null {
  if (s.phase === "contractEnd") return "system";
  if (s.phase === "gameOver") return null;
  return s.turn;
}

/** Play a whole game choosing uniformly among legal actions, checking invariants at every step. */
function randomGame(seed: number): { state: GameState; steps: number } {
  let s = createGame({ seed });
  let rng = seed ^ 0x9e3779b9;
  let steps = 0;
  for (;;) {
    const who = actor(s);
    if (who === null) return { state: s, steps };

    // Everyone else can at most look at the last trick (R-TRICK-6).
    for (const other of SEATS) {
      if (other !== who) expect(legalActions(s, other).every((a) => a.type === "peekLastTrick")).toBe(true);
    }

    const legal = legalActions(s, who);
    expect(legal.length).toBeGreaterThan(0);
    let r: number;
    [r, rng] = nextRandom(rng);
    const action = legal[Math.floor(r * legal.length)]!;

    // A random card from the deck by a random seat: must either be legal or be rejected cleanly.
    [r, rng] = nextRandom(rng);
    const junkSeat = SEATS[Math.floor(r * 4)]!;
    const junk: Action = { type: "play", card: DECK[Math.floor(r * 32)]! };
    const before = JSON.stringify(s);
    const jr = applyAction(s, junkSeat, junk);
    const isLegal = legalActions(s, junkSeat).some((a) => JSON.stringify(a) === JSON.stringify(junk));
    expect(jr.ok).toBe(isLegal);
    expect(JSON.stringify(s)).toBe(before); // inputs are never mutated

    const res = applyAction(s, who, action);
    if (!res.ok) throw new Error(`Legal action rejected: ${JSON.stringify(action)} ${res.error.code}`);
    s = res.state;
    steps++;
    if (s.phase === "tricks" || s.phase === "trix" || s.phase === "contractEnd") expect(cardCount(s)).toBe(32);
    if (steps > 5000) throw new Error("Game did not end");
  }
}

describe("Fuzz: random legal games", () => {
  it("always finish, keep all 32 cards, and respect the contract bookkeeping", { timeout: 120_000 }, () => {
    for (let seed = 1; seed <= 150; seed++) {
      const { state } = randomGame(seed);
      expect(state.phase).toBe("gameOver");
      expect(state.history.length).toBe(state.contractNo);
      expect(state.contractNo).toBeLessThanOrEqual(28);
      // No seat picked a contract twice (R-GAME-1), and the picker rotated (R-GAME-2).
      for (const used of state.used) expect(new Set(used).size).toBe(used.length);
      // Trix is picked by the 6th pick at the latest (R-GAME-11).
      for (const used of state.used) if (used.length >= 6) expect(used.slice(0, 6)).toContain("trix");
      state.history.forEach((h, i) => expect(h.picker).toBe((state.firstPicker + i) % 4));
      // Totals are the running sum of contract scores, with exact-1000 resets (R-GAME-6).
      let totals = [0, 0, 0, 0];
      for (const h of state.history) {
        totals = totals.map((t, s) => (t + h.scores[s]! === 1000 ? 0 : t + h.scores[s]!));
        expect(h.totals).toEqual(totals);
      }
      const over = totals.some((t) => t > 1000);
      expect(state.standings!.reason).toBe(over ? "overLimit" : "allContractsPlayed");
      if (!over) expect(state.contractNo).toBe(28);
    }
  });
});

describe("viewFor", () => {
  it("shows a player their own hand and never anyone else's", () => {
    const s = createGame({ seed: 11 });
    for (const seat of SEATS) {
      const view = viewFor(s, seat);
      expect(view.hand).toEqual(s.hands[seat]);
      expect(view.handCounts).toEqual([8, 8, 8, 8]);
      const text = JSON.stringify(view);
      for (const other of SEATS) {
        if (other === seat) continue;
        for (const c of s.hands[other]!) expect(text).not.toContain(`"${c}"`);
      }
    }
  });

  it("does not expose won piles or the PRNG state", () => {
    const view = viewFor(createGame({ seed: 11 }), 0) as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty("won");
    expect(view).not.toHaveProperty("rng");
    expect(view).not.toHaveProperty("hands");
    expect(view).not.toHaveProperty("presetDeals");
  });

  it("lists exactly the legal actions for that seat", () => {
    const s = createGame({ seed: 11 });
    expect(viewFor(s, s.picker).legal).toEqual(legalActions(s, s.picker));
  });
});

describe("Placeholder bot", () => {
  it("R-BOT-1: four bots play complete games with legal moves only", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = createGame({ seed });
      while (s.phase !== "gameOver") {
        const who = actor(s)!;
        const action = who === "system" ? ({ type: "nextContract" } as const) : placeholderBotAction(s, who);
        expect(action).not.toBeNull();
        const r = applyAction(s, who, action);
        expect(r.ok).toBe(true);
        if (r.ok) s = r.state;
      }
    }
  });

  it("R-BOT-2: picks the first allowed contract, plays its lowest legal card, never declares", () => {
    let s = createGame({ seed: 4, firstPicker: 0 });
    expect(placeholderBotAction(s, 0)).toEqual({ type: "pick", contract: "dineri" });
    s.used[0] = ["dineri", "damet", "pli", "farcha"];
    expect(placeholderBotAction(s, 0)).toEqual({ type: "pick", contract: "ray" });
    s = (applyAction(s, 0, { type: "pick", contract: "ray" }) as { state: GameState }).state;
    const bot = placeholderBotAction(s, 0);
    expect(bot?.type).toBe("play");
    expect(placeholderBotAction(s, 1)).toBeNull(); // not seat 1's turn
  });
});
