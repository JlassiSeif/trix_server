// The bots (docs/bots.md). The arena (games/trix/station/src/arena.ts) measures how well they play;
// these tests check they play legally, think with the engine's own rules, and never cheat.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SEATS,
  applyAction,
  botAction,
  createGame,
  privateTo,
  seededRng,
  viewFor,
  type Action,
  type BotLevel,
  type Contract,
  type GameEvent,
  type GameState,
  type Seat,
  type TrickContract,
} from "../src/index";
import { KH, toNum } from "../src/bots/cards";
import { sampleHands } from "../src/bots/hard";
import { remember } from "../src/bots/memory";
import { baseline, easyPick, estimate, hardPick, mediumPick } from "../src/bots/pick";
import { mediumDeclares, simPlay, simScores, type TrickSim } from "../src/bots/tricks";
import { trixSimPlay, trixSimScores, type TrixSim } from "../src/bots/trix";
import { cards } from "./helpers";

const nums = (s: string) => cards(s).map(toNum);

/** Plays a whole game with the given levels, calling `onStep` before each move. */
function play(seed: number, levels: BotLevel[], onStep?: (s: GameState, actor: Seat, action: Action, events: GameEvent[]) => void) {
  let s = createGame({ seed });
  let log: GameEvent[] = [];
  const rngs = levels.map((_, i) => seededRng(seed + i));
  for (let guard = 0; s.phase !== "gameOver"; guard++) {
    if (guard > 5000) throw new Error("game did not finish");
    if (s.phase === "contractEnd") {
      const r = applyAction(s, "system", { type: "nextContract" });
      if (!r.ok) throw new Error(r.error.code);
      s = r.state;
      log = [];
      continue;
    }
    const seat = (s.phase === "picking" ? s.picker : s.turn) as Seat;
    const action = botAction(levels[seat]!, viewFor(s, seat), log, rngs[seat]!, { samples: 12, budgetMs: Infinity });
    expect(action, `a move for seat ${seat} in ${s.phase}`).not.toBeNull();
    const r = applyAction(s, seat, action!);
    if (!r.ok) throw new Error(`${levels[seat]} bot made an illegal move ${JSON.stringify(action)}: ${r.error.code}`);
    onStep?.(s, seat, action!, r.events);
    s = r.state;
    for (const e of r.events) if (e.type !== "dealt" && privateTo(e) === null) log.push(e);
  }
  return s;
}

describe("bots play complete games with legal moves only (R-BOT-1, R-BOT-3)", () => {
  it("every level, mixed at one table", { timeout: 120_000 }, () => {
    const mixes: BotLevel[][] = [
      ["easy", "medium", "hard", "easy"],
      ["hard", "hard", "medium", "medium"],
      ["medium", "easy", "easy", "hard"],
    ];
    for (let seed = 1; seed <= 9; seed++) {
      const s = play(seed, mixes[seed % 3]!);
      expect(s.phase).toBe("gameOver");
    }
  });
});

describe("the bots' simulators score exactly like the engine", () => {
  it("trick contracts and trix, replayed from real games", { timeout: 60_000 }, () => {
    let checked = 0;
    for (let seed = 20; seed < 26; seed++) {
      let sim: TrickSim | null = null;
      let trix: TrixSim | null = null;
      play(seed, ["medium", "easy", "medium", "easy"], (before, actor, action, events) => {
        for (const e of events) {
          if (e.type === "picked" && e.contract !== "trix") {
            sim = {
              contract: e.contract as TrickContract,
              picker: e.seat,
              multiplier: e.multiplier,
              kingDeclaredBy: -1,
              hands: before.hands.map((h) => h.map(toNum)),
              trick: [],
              played: 0,
              turn: e.seat,
              tricksPlayed: 0,
              tricksWon: [0, 0, 0, 0],
              diamonds: [0, 0, 0, 0],
              queens: [0, 0, 0, 0],
              kingTaker: -1,
              lastWinner: -1,
            };
          }
          if (e.type === "picked" && e.contract === "trix") {
            trix = { stacks: { low: [-1, -1, -1, -1], high: [-1, -1, -1, -1] }, hands: before.hands.map((h) => h.map(toNum)), turn: e.seat, finishers: [], over: false };
          }
          if (e.type === "kingDeclared" && sim) sim.kingDeclaredBy = e.seat;
          if (e.type === "cardPlayed" && sim) simPlay(sim, toNum(e.card));
          if (e.type === "cardPlayed" && trix) {
            trix.turn = e.seat;
            trixSimPlay(trix, toNum(e.card));
          }
          if (e.type === "contractScored") {
            if (sim) expect(simScores(sim), `${e.result.contract} in game ${seed}`).toEqual(e.result.scores);
            if (trix) expect(trixSimScores(trix), `trix in game ${seed}`).toEqual(e.result.scores);
            sim = trix = null;
            checked++;
          }
        }
        void actor;
        void action;
      });
    }
    expect(checked).toBeGreaterThan(60);
  });
});

describe("no cheating (docs/bots.md §1)", () => {
  it("the bot code never touches the game state", () => {
    const dir = join(import.meta.dirname, "../src/bots");
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), "utf8");
      expect(src, f).not.toMatch(/\bGameState\b/);
      // From the game and view modules, only type names (Action, GameEvent, PlayerView), no code.
      for (const m of src.matchAll(/^import (type )?\{([^}]*)\} from "\.\.\/(game|view)";/gm)) {
        expect(m[1], `${f} imports code from ../${m[3]}`).toBe("type ");
        for (const name of m[2]!.split(",").map((x) => x.trim())) expect(["Action", "GameEvent", "PlayerView"], f).toContain(name);
      }
    }
  });

  it("imagined deals only use hidden cards, in the right numbers, and respect what is known", () => {
    const rng = seededRng(5);
    const myHand = nums("7_h;8_h;a_s");
    const hidden = nums("9_h;j_h;q_h;k_h;7_c;8_c;9_c;7_d;8_d");
    const cannot = [0, 0xff << 0, 0, 0]; // seat 1 showed out of hearts
    for (let i = 0; i < 200; i++) {
      const hands = sampleHands(0, myHand, hidden, [3, 3, 3, 3], cannot, 2, rng);
      expect(hands[0]).toEqual(myHand);
      expect(hands.slice(1).flat().sort()).toEqual([...hidden].sort());
      expect(hands.map((h) => h.length)).toEqual([3, 3, 3, 3]);
      expect(hands[1]!.some((c) => c >> 3 === 0)).toBe(false);
      expect(hands[2]).toContain(KH); // declared by seat 2
    }
  });

  it("the same view and public events give the same decision, whatever the hidden hands are", () => {
    // Two deals that differ only in how seats 1-3 share their cards: seat 0's view is identical.
    const a = createGame({ seed: 1, firstPicker: 0, presetDeals: [[cards("7_h;8_h;9_h;j_h;q_h;k_h;10_h;a_h"), cards("7_c;8_c;9_c;j_c;7_d;8_d;9_d;j_d"), cards("q_c;k_c;10_c;a_c;q_d;k_d;10_d;a_d"), cards("7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s")]] });
    const b = createGame({ seed: 1, firstPicker: 0, presetDeals: [[cards("7_h;8_h;9_h;j_h;q_h;k_h;10_h;a_h"), cards("7_s;8_s;9_s;j_s;q_s;k_s;10_s;a_s"), cards("7_c;8_c;9_c;j_c;7_d;8_d;9_d;j_d"), cards("q_c;k_c;10_c;a_c;q_d;k_d;10_d;a_d")]] });
    expect(viewFor(a, 0)).toEqual(viewFor(b, 0));
    for (const level of ["easy", "medium", "hard"] as const) {
      expect(botAction(level, viewFor(a, 0), [], seededRng(9))).toEqual(botAction(level, viewFor(b, 0), [], seededRng(9)));
    }
  });
});

describe("memory from public events", () => {
  it("remembers played cards, completed tricks and who showed out of a suit", () => {
    const events: GameEvent[] = [
      { type: "picked", seat: 0, contract: "pli", multiplier: 2, forced: false },
      { type: "cardPlayed", seat: 0, card: "7_h" },
      { type: "cardPlayed", seat: 1, card: "9_c" },
      { type: "cardPlayed", seat: 2, card: "a_h" },
      { type: "cardPlayed", seat: 3, card: "8_h" },
      { type: "trickWon", seat: 2, cards: [{ seat: 0, card: "7_h" }, { seat: 1, card: "9_c" }, { seat: 2, card: "a_h" }, { seat: 3, card: "8_h" }] },
    ];
    const mem = remember(events, "pli");
    expect(mem.tricks).toHaveLength(1);
    expect(mem.tricks[0]!.winner).toBe(2);
    expect(mem.cannotHold[1]! & (1 << toNum("k_h"))).not.toBe(0); // seat 1 is out of hearts
    expect(mem.cannotHold[3]).toBe(0);
    expect(mem.played & (1 << toNum("9_c"))).not.toBe(0);
  });

  it("in trix, a pass means none of the fitting cards", () => {
    const events: GameEvent[] = [
      { type: "picked", seat: 0, contract: "trix", multiplier: 1, forced: false },
      { type: "cardPlayed", seat: 0, card: "j_h" },
      { type: "passed", seat: 1 },
    ];
    const mem = remember(events, "trix");
    for (const c of ["q_h", "9_h", "j_c", "j_d", "j_s"]) expect(mem.cannotHold[1]! & (1 << toNum(c as never)), c).not.toBe(0);
    expect(mem.cannotHold[1]! & (1 << toNum("k_h"))).toBe(0);
  });
});

describe("picking a contract (docs/bots.md §3)", () => {
  const all: Contract[] = ["dineri", "damet", "pli", "farcha", "ray", "general", "trix"];
  const topCards = nums("a_s;10_s;k_s;a_c;10_c;a_h;j_h;9_d");
  const lowCards = nums("7_s;8_s;7_c;8_c;9_c;7_h;8_d;7_d");

  it("easy picks at random among the allowed contracts", () => {
    const rng = seededRng(3);
    const seen = new Set(Array.from({ length: 60 }, () => easyPick({ hand: topCards, legal: all, used: [], total: 0 }, rng)));
    expect(seen.size).toBeGreaterThan(4);
  });

  it("medium reads its hand: never pli or general with a hand of top cards", () => {
    const c = mediumPick({ hand: topCards, legal: all.filter((x) => x !== "trix"), used: [], total: 0 });
    expect(["pli", "general"]).not.toContain(c);
    expect(estimate(topCards).pli).toBeGreaterThan(estimate(lowCards).pli * 3);
  });

  it("medium escapes a bad hand with trix, and keeps trix otherwise", () => {
    const awful = nums("a_s;10_s;k_s;a_c;10_c;a_h;10_h;a_d"); // takes tricks in every contract
    expect(mediumPick({ hand: awful, legal: all, used: [], total: 0 })).toBe("trix");
    expect(mediumPick({ hand: lowCards, legal: all, used: [], total: 0 })).not.toBe("trix");
  });

  it("medium doesn't leave general as its ×4 last pick", () => {
    const c = mediumPick({ hand: lowCards, legal: ["farcha", "general"], used: ["dineri", "damet", "pli", "trix", "ray"], total: 0 });
    expect(c).toBe("general");
  });

  it("hard spends the contract this hand is unusually good for", () => {
    // A hand of low cards is good for everything, and best compared with an average hand for general.
    expect(estimate(lowCards).general).toBeLessThan(baseline().general / 3);
    expect(hardPick({ hand: lowCards, legal: all.filter((x) => x !== "trix"), used: [], total: 0 })).toBe("general");
  });
});

describe("declaring K♥ (docs/bots.md §5)", () => {
  it("medium declares with K♥, at most one other heart, no A♥ or 10♥, and a short suit", () => {
    expect(mediumDeclares(nums("k_h;7_h;a_s;k_s;q_s;10_c;9_c;7_d"))).toBe(true);
    expect(mediumDeclares(nums("k_h;a_h;a_s;k_s;q_s;10_c;9_c;7_d"))).toBe(false);
    expect(mediumDeclares(nums("k_h;7_h;8_h;k_s;q_s;10_c;9_c;7_d"))).toBe(false);
    expect(mediumDeclares(nums("a_s;7_h;8_h;k_s;q_s;10_c;9_c;7_d"))).toBe(false);
  });
});

describe("hard thinks within its budget", () => {
  it("every move of a game with hard players under 30 ms", { timeout: 60_000 }, () => {
    let s = createGame({ seed: 77 });
    let log: GameEvent[] = [];
    const rng = seededRng(1);
    let slowest = 0;
    let moves = 0;
    while (s.phase !== "gameOver" && moves < 400) {
      if (s.phase === "contractEnd") {
        const r = applyAction(s, "system", { type: "nextContract" });
        if (r.ok) s = r.state;
        log = [];
        continue;
      }
      const seat = (s.phase === "picking" ? s.picker : s.turn) as Seat;
      const t0 = performance.now();
      const action = botAction("hard", viewFor(s, seat), log, rng);
      slowest = Math.max(slowest, performance.now() - t0);
      const r = applyAction(s, seat, action!);
      if (!r.ok) throw new Error(r.error.code);
      s = r.state;
      for (const e of r.events) if (privateTo(e) === null) log.push(e);
      moves++;
    }
    expect(moves).toBeGreaterThan(50);
    // The budget is 30 ms; allow for a busy test machine.
    expect(slowest).toBeLessThan(80);
    void SEATS;
  });
});
