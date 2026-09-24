// The platform runs any game through the game contract, not just Trix. "Race to 10" is a tiny
// test-only game: 2 players take turns adding 1 or 2; whoever reaches 10 wins the round; best of
// three. If the platform secretly depended on Trix, this game could not run.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameModule } from "@platform/sdk";
import type { ServerMessage } from "@platform/protocol";
import { GAMES } from "../src/games";
import { Hub } from "../src/hub";
import type { Conn } from "../src/room";

interface RaceState {
  total: number;
  turn: number;
  rounds: number[];
  phase: "playing" | "break" | "over";
}
type RaceEvent = { type: "added"; seat: number; n: number } | { type: "roundWon"; seat: number } | { type: "roundStarted" };

const race: GameModule<RaceState, { total: number; you: number; turn: number; legal: number[] }, RaceEvent> = {
  meta: { id: "race", name: "Race to 10", version: "0.1.0", sdk: "1.0.0", seats: { min: 2, max: 2 }, botLevels: ["easy"], standInLevel: "easy" },
  create: () => ({ total: 0, turn: 0, rounds: [0, 0], phase: "playing" }),
  started: () => [{ type: "roundStarted" }],
  apply(state, actor, action) {
    if (actor === "system") {
      if (state.phase !== "break") return { ok: false, error: { code: "WRONG_PHASE", message: "No break" } };
      return { ok: true, state: { ...state, total: 0, phase: "playing" }, events: [{ type: "roundStarted" }] };
    }
    const n = (action as { n?: unknown })?.n;
    if (state.phase !== "playing" || actor !== state.turn) return { ok: false, error: { code: "NOT_YOUR_TURN", message: "Wait" } };
    if (n !== 1 && n !== 2) return { ok: false, error: { code: "BAD_ACTION", message: "1 or 2" } };
    const total = state.total + n;
    const events: RaceEvent[] = [{ type: "added", seat: actor, n }];
    if (total < 10) return { ok: true, state: { ...state, total, turn: 1 - actor }, events };
    const rounds = state.rounds.map((w, s) => (s === actor ? w + 1 : w));
    events.push({ type: "roundWon", seat: actor });
    return { ok: true, state: { total, turn: 1 - actor, rounds, phase: rounds[actor] === 2 ? "over" : "break" }, events };
  },
  view: (state, seat) => ({ total: state.total, you: seat, turn: state.turn, legal: state.phase === "playing" && state.turn === seat ? [1, 2] : [] }),
  privateTo: () => null,
  actors: (state) => (state.phase === "playing" ? [state.turn] : []),
  status: (state) => {
    if (state.phase === "over") {
      const w = state.rounds[0]! === 2 ? 0 : 1;
      return { kind: "over", result: { order: [w, 1 - w], winners: [w], losers: [1 - w] } };
    }
    return state.phase === "break" ? { kind: "break", next: { type: "nextRound" }, seconds: 5 } : { kind: "playing" };
  },
  isRoundStart: (e) => e.type === "roundStarted",
  pace: () => 300,
  bot: (_level, view) => (view.legal.length ? { n: view.total === 7 || view.total === 8 ? 10 - view.total : 1 } : null),
  fallback: (state) => (state.phase === "playing" ? { n: 1 } : null),
};

class FakeConn implements Conn {
  inbox: ServerMessage[] = [];
  send(msg: ServerMessage) {
    this.inbox.push(structuredClone(msg));
  }
  close() {}
  last<T extends ServerMessage["type"]>(type: T) {
    return [...this.inbox].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }>;
  }
  errors() {
    return this.inbox.filter((m) => m.type === "error").map((m) => (m as { code: string }).code);
  }
}

let hub: Hub;
const send = (c: FakeConn, msg: object) => hub.receive(c, JSON.stringify(msg));
beforeEach(() => {
  vi.useFakeTimers();
  hub = new Hub({ seed: () => 1, games: { ...GAMES, race: race as unknown as GameModule }, closedGames: new Set(["closedone"]) });
});
afterEach(() => vi.useRealTimers());

describe("the game contract: the platform runs a game it knows nothing about", () => {
  it("a 2-seat game with its own rules, bots, breaks and result, played to the end against a bot", () => {
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", game: "race", bots: "easy" });
    const room = hub.rooms.get(me.last("joined").roomId)!;
    expect(room.seats).toHaveLength(2);
    expect(me.last("update").room).toMatchObject({ game: "race", gameVersion: "0.1.0", status: "playing" });
    for (let i = 0; i < 400 && room.status !== "finished"; i++) {
      const u = me.last("update");
      const view = u.game as { legal: number[] };
      if (view?.legal.length) send(me, { type: "action", action: { n: 2 } });
      else if (room.gameStatus()?.kind === "break" && !room.continued.has(0)) send(me, { type: "continue" });
      vi.advanceTimersByTime(400);
    }
    expect(room.status).toBe("finished");
    expect(me.errors()).toEqual([]);
    // Play again (R-TABLE-8) works for any game: the bot is always ready.
    send(me, { type: "ready" });
    expect(room.status).toBe("playing");
  });

  it("refuses an unknown game and a level the game doesn't offer", () => {
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", game: "chess" });
    send(me, { type: "createRoom", name: "Seif", game: "race", bots: "hard" });
    send(me, { type: "createRoom", name: "Seif", game: "__proto__" });
    expect(me.errors()).toEqual(["BAD_MESSAGE", "BAD_MESSAGE", "BAD_MESSAGE"]);
    expect(hub.rooms.size).toBe(0);
  });

  it("a game switched off takes no new tables (docs/architecture.md §12)", () => {
    hub = new Hub({ seed: () => 1, games: { ...GAMES, race: race as unknown as GameModule }, closedGames: new Set(["race"]) });
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", game: "race" });
    expect(me.errors()).toEqual(["GAME_CLOSED"]);
    send(me, { type: "createRoom", name: "Seif" }); // Trix is still open
    expect(me.last("joined")).toBeTruthy();
    expect(hub.listGames().map((g) => [g.id, g.open])).toEqual([
      ["trix", true],
      ["race", false],
    ]);
  });

  it("saved rooms come back with their own game", () => {
    const me = new FakeConn();
    send(me, { type: "createRoom", name: "Seif", game: "race", bots: "easy" });
    const snap = JSON.parse(JSON.stringify(hub.snapshot()));
    expect(snap.rooms[0].gameId).toBe("race");
    const again = new Hub({ seed: () => 1, games: { ...GAMES, race: race as unknown as GameModule } });
    again.restore(snap);
    expect([...again.rooms.values()][0]!.module.meta.id).toBe("race");
    again.stopTimers();
    // A server without that game skips the room instead of crashing.
    const without = new Hub({ seed: () => 1 });
    expect(without.restore(snap)).toBe(0);
  });
});
